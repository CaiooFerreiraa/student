import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  createGeneratedQuizSchema,
  flattenGeneratedQuiz,
  type GeneratedQuestion,
} from "@/domain/quiz/generated-quiz";
import { AiFeature, RunStatus } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { aiRuns, materialChunks, materials, quizzes, quizVersionMaterials, quizVersions, subjects } from "@/lib/server/db/schema";
import { getAiEnv } from "@/lib/server/env";
import { persistGeneratedQuiz } from "@/lib/server/quizzes/persist-generated-quiz";

export const QUIZ_GENERATION_PROMPT_VERSION = "quiz-generation-v4";

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
): Promise<GeneratedQuestion[]> {
  const schema = createGeneratedQuizSchema(expected);
  const structured = model.withStructuredOutput(schema, {
    name: "generated_quiz_v3",
  });
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await structured.invoke(
        `${prompt}\n\n${attempt === 1 ? "" : "CORREÇÃO OBRIGATÓRIA: a tentativa anterior não respeitou o schema. Retorne novamente todos os blocos com as quantidades exatas."}`,
      );
      return flattenGeneratedQuiz(result);
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
      `Gere um quiz usando exclusivamente as fontes fornecidas. Não invente fatos. Cada questão deve citar ao menos uma SOURCE válida. Os enunciados são exibidos como texto uniforme: nunca se refira a palavra, termo ou trecho "destacado", "grifado", "sublinhado", "em negrito" ou "em itálico". Quando precisar indicar um termo específico, reproduza-o explicitamente entre aspas no próprio enunciado. Retorne um objeto com três arrays: multipleChoice com EXATAMENTE ${expected.multipleChoice} itens, trueFalse com EXATAMENTE ${expected.trueFalse} itens e open com EXATAMENTE ${expected.open} itens. Não mova questões entre os arrays. Preencha com null os campos que não se aplicam ao tipo de questão e explicações de alternativas ausentes.\n\nTítulo: ${quiz.title}\nDescrição: ${quiz.description ?? ""}\nDisciplina: ${quizRow?.subject?.name ?? "Geral"}\nEscolaridade: ${version.educationLevel}\nDificuldade: ${version.difficulty}\n\nFONTES:\n${contextParts.join("\n\n")}`,
      expected,
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
