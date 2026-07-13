import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  createGeneratedQuizSchema,
  flattenGeneratedQuiz,
  type GeneratedQuestion,
} from "@/domain/quiz/generated-quiz";
import { assertGeneratedQuestionsAreOriginal } from "@/domain/quiz/generated-quiz-quality";
import { AiFeature, RunStatus } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { aiRuns, materialChunks, materials, quizzes, quizVersionMaterials, quizVersions, subjects } from "@/lib/server/db/schema";
import { getAiEnv } from "@/lib/server/env";
import { persistGeneratedQuiz } from "@/lib/server/quizzes/persist-generated-quiz";

export const QUIZ_GENERATION_PROMPT_VERSION = "quiz-generation-v5";

type Distribution = { multipleChoice: number; trueFalse: number; open: number };

function distribution(value: unknown): Distribution {
  return z
    .object({
      multipleChoice: z.number().int(),
      trueFalse: z.number().int(),
      open: z.number().int(),
    })
    .parse(value);
}

async function generateStructuredQuestions(
  model: ChatOpenAI,
  prompt: string,
  expected: Distribution,
  sourceContents: string[],
): Promise<GeneratedQuestion[]> {
  const schema = createGeneratedQuizSchema(expected);
  const structured = model.withStructuredOutput(schema, {
    name: "generated_quiz_v5",
  });
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const correction = attempt === 1 ? "" : [
        "CORREÇÃO OBRIGATÓRIA: a tentativa anterior foi rejeitada.",
        lastError instanceof Error ? `Motivo: ${lastError.message}` : "Motivo: saída inválida.",
        "Refaça todos os blocos, mantendo as quantidades exatas e corrigindo o problema apontado.",
      ].join("\n");
      const result = await structured.invoke(
        `${prompt}\n\n${correction}`,
      );
      const questions = flattenGeneratedQuiz(result);
      assertGeneratedQuestionsAreOriginal(questions, sourceContents);
      return questions;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("A IA não retornou questões válidas.");
}

export async function generateQuizVersion(
  userId: string,
  quizId: string,
): Promise<void> {
  const [quizRow] = await db.select({ quiz: quizzes, subject: subjects }).from(quizzes).leftJoin(subjects, eq(quizzes.subjectId, subjects.id))
    .where(and(eq(quizzes.id, quizId), eq(quizzes.ownerId, userId), isNull(quizzes.deletedAt))).limit(1);
  const quiz = quizRow?.quiz;
  const [version] = quiz ? await db.select().from(quizVersions).where(eq(quizVersions.quizId, quiz.id)).orderBy(desc(quizVersions.versionNumber)).limit(1) : [];
  if (!quiz || !version) throw new Error("Quiz não encontrado.");
  const expected = distribution(version.questionDistribution);
  const versionMaterialRows = await db.select({ materialId: quizVersionMaterials.materialId }).from(quizVersionMaterials).where(eq(quizVersionMaterials.quizVersionId, version.id));
  const materialIds = versionMaterialRows.map((entry) => entry.materialId);
  if (materialIds.length === 0)
    throw new Error("Selecione ao menos um material para gerar o quiz.");

  const chunks = await db.select({ id: materialChunks.id, materialId: materialChunks.materialId, content: materialChunks.content, pageStart: materialChunks.pageStart, pageEnd: materialChunks.pageEnd, materialTitle: materials.title })
    .from(materialChunks).innerJoin(materials, eq(materialChunks.materialId, materials.id)).where(inArray(materialChunks.materialId, materialIds))
    .orderBy(asc(materialChunks.materialId), asc(materialChunks.position)).limit(120);
  let usedCharacters = 0;
  const sourceMap = new Map<string, (typeof chunks)[number]>();
  const contextParts: string[] = [];
  for (const chunk of chunks) {
    if (usedCharacters + chunk.content.length > 80_000) break;
    const key = `SOURCE_${sourceMap.size + 1}`;
    sourceMap.set(key, chunk);
    contextParts.push(
      `[${key}] Material: ${chunk.materialTitle}; página: ${chunk.pageStart ?? "não informada"}\n${chunk.content}`,
    );
    usedCharacters += chunk.content.length;
  }
  if (!contextParts.length)
    throw new Error("Os materiais ainda não possuem texto processado.");

  const aiEnv = getAiEnv();
  const [run] = await db.insert(aiRuns).values({
      userId,
      feature: AiFeature.QUIZ_GENERATION,
      targetType: "QuizVersion",
      targetId: version.id,
      status: RunStatus.RUNNING,
      model: aiEnv.OPENAI_CHAT_MODEL,
      promptVersion: QUIZ_GENERATION_PROMPT_VERSION,
    }).returning();
  if (!run) throw new Error("Não foi possível registrar a geração.");
  await db.transaction(async (transaction) => {
    await transaction.update(quizzes).set({ status: "GENERATING", updatedAt: new Date() }).where(eq(quizzes.id, quiz.id));
    await transaction.update(quizVersions).set({ status: "GENERATING", generationModel: aiEnv.OPENAI_CHAT_MODEL, promptVersion: QUIZ_GENERATION_PROMPT_VERSION }).where(eq(quizVersions.id, version.id));
  });

  try {
    const model = new ChatOpenAI({
      apiKey: aiEnv.OPENAI_API_KEY,
      model: aiEnv.OPENAI_CHAT_MODEL,
    });
    const questions = await generateStructuredQuestions(
      model,
      `Gere um quiz usando exclusivamente as fontes fornecidas. Não invente fatos. Cada questão deve citar ao menos uma SOURCE válida.

FLUXO OBRIGATÓRIO DE GERAÇÃO — execute internamente nesta ordem:

ETAPA 1 — ANALISAR AS FONTES
- Separe conteúdo expositivo de exercícios, provas, perguntas e gabaritos já existentes.
- Extraia conceitos, relações, regras, causas, consequências e exemplos que podem ser ensinados.
- Condição de avanço: saber qual conhecimento sustenta cada questão planejada.

ETAPA 2 — PLANEJAR QUESTÕES ORIGINAIS
- Quando uma SOURCE contiver perguntas, use somente o assunto e o conhecimento subjacente.
- É PROIBIDO copiar, completar, converter o tipo ou fazer paráfrase próxima de uma pergunta da SOURCE.
- Crie outro enunciado, outra situação e outra operação cognitiva. Exemplo: se a fonte pede uma definição, crie uma aplicação em cenário; se pede aplicação, crie comparação ou diagnóstico.
- Se não for possível criar uma questão realmente nova a partir de um trecho, não use esse trecho.
- Condição de avanço: cada questão deve continuar válida mesmo para quem nunca viu o material original.

ETAPA 3 — ESCREVER PARA ENSINAR
- Enunciado autossuficiente: não escreva “segundo o material”, “conforme a fonte”, “no trecho apresentado” ou equivalentes.
- A interface exibe o enunciado com formatação uniforme. Nunca se refira a “em destaque”, “destacado”, “grifo”, “sublinhado”, “negrito” ou “itálico”. Para indicar um termo, escreva-o explicitamente entre aspas.
- A explicação geral deve ter ao menos 140 caracteres e ensinar em duas ou mais frases: (1) apresente a resposta ou princípio correto; (2) desenvolva o raciocínio causal, lógico ou conceitual; (3) esclareça o erro ou confusão mais provável. Não use “o material diz/fala/confirma” como justificativa.
- Em verdadeiro/falso, explique a proposição e, quando falsa, formule explicitamente a correção.
- Em múltipla escolha, TODA alternativa deve ter explicação de ao menos 60 caracteres mostrando conceitualmente por que ela está correta ou incorreta.
- Em questão aberta, forneça resposta-modelo didática com ao menos 120 caracteres e critérios objetivos de correção.

ETAPA 4 — AUDITAR ANTES DE RESPONDER
Para cada questão, confirme internamente:
[ ] É original e não reproduz uma pergunta da fonte.
[ ] É autossuficiente e não depende de destaque visual nem de consulta ao material.
[ ] A explicação ensina o raciocínio, em vez de apenas declarar que a fonte confirma a resposta.
[ ] Cada alternativa possui justificativa específica.
[ ] Todas as SOURCE keys existem e sustentam os fatos usados.
Se qualquer item falhar, reescreva a questão antes de retornar.

CONTRATO DE SAÍDA:
- Retorne multipleChoice com EXATAMENTE ${expected.multipleChoice} itens, trueFalse com EXATAMENTE ${expected.trueFalse} itens e open com EXATAMENTE ${expected.open} itens.
- Não mova questões entre arrays.
- Use null somente nos campos que não se aplicam ao tipo de questão. Explicações das alternativas de múltipla escolha nunca são null.

Título: ${quiz.title}
Descrição: ${quiz.description ?? ""}
Disciplina: ${quizRow?.subject?.name ?? "Geral"}
Escolaridade: ${version.educationLevel}
Dificuldade: ${version.difficulty}

FONTES:
${contextParts.join("\n\n")}`,
      expected,
      [...sourceMap.values()].map((chunk) => chunk.content),
    );

    await persistGeneratedQuiz({
      quizId: quiz.id,
      versionId: version.id,
      aiRunId: run.id,
      questions,
      sources: sourceMap,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao gerar quiz.";
    const failedAt = new Date();
    await db.transaction(async (transaction) => {
      await transaction.update(quizzes).set({ status: "DRAFT", updatedAt: failedAt }).where(eq(quizzes.id, quiz.id));
      await transaction.update(quizVersions).set({ status: "FAILED" }).where(eq(quizVersions.id, version.id));
      await transaction.update(aiRuns).set({ status: RunStatus.FAILED, errorMessage: message, completedAt: failedAt }).where(eq(aiRuns.id, run.id));
    });
    throw error;
  }
}
