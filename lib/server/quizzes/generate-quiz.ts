import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import {
  createGeneratedQuizSchema,
  flattenGeneratedQuiz,
  type GeneratedQuestion,
} from "@/domain/quiz/generated-quiz";
import { AiFeature, RunStatus } from "@/generated/prisma/enums";
import { getAiEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { persistGeneratedQuiz } from "@/lib/server/quizzes/persist-generated-quiz";

export const QUIZ_GENERATION_PROMPT_VERSION = "quiz-generation-v3";

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
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, ownerId: userId, deletedAt: null },
    include: {
      subject: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { materials: { include: { material: true } } },
      },
    },
  });
  const version = quiz?.versions[0];
  if (!quiz || !version) throw new Error("Quiz não encontrado.");
  const expected = distribution(version.questionDistribution);
  const materialIds = version.materials.map((entry) => entry.materialId);
  if (materialIds.length === 0)
    throw new Error("Selecione ao menos um material para gerar o quiz.");

  const chunks = await prisma.materialChunk.findMany({
    where: { materialId: { in: materialIds } },
    orderBy: [{ materialId: "asc" }, { position: "asc" }],
    take: 120,
    include: { material: { select: { title: true } } },
  });
  let usedCharacters = 0;
  const sourceMap = new Map<string, (typeof chunks)[number]>();
  const contextParts: string[] = [];
  for (const chunk of chunks) {
    if (usedCharacters + chunk.content.length > 80_000) break;
    const key = `SOURCE_${sourceMap.size + 1}`;
    sourceMap.set(key, chunk);
    contextParts.push(
      `[${key}] Material: ${chunk.material.title}; página: ${chunk.pageStart ?? "não informada"}\n${chunk.content}`,
    );
    usedCharacters += chunk.content.length;
  }
  if (!contextParts.length)
    throw new Error("Os materiais ainda não possuem texto processado.");

  const aiEnv = getAiEnv();
  const run = await prisma.aiRun.create({
    data: {
      userId,
      feature: AiFeature.QUIZ_GENERATION,
      targetType: "QuizVersion",
      targetId: version.id,
      status: RunStatus.RUNNING,
      model: aiEnv.OPENAI_CHAT_MODEL,
      promptVersion: QUIZ_GENERATION_PROMPT_VERSION,
    },
  });
  await prisma.$transaction([
    prisma.quiz.update({
      where: { id: quiz.id },
      data: { status: "GENERATING" },
    }),
    prisma.quizVersion.update({
      where: { id: version.id },
      data: {
        status: "GENERATING",
        generationModel: aiEnv.OPENAI_CHAT_MODEL,
        promptVersion: QUIZ_GENERATION_PROMPT_VERSION,
      },
    }),
  ]);

  try {
    const model = new ChatOpenAI({
      apiKey: aiEnv.OPENAI_API_KEY,
      model: aiEnv.OPENAI_CHAT_MODEL,
    });
    const questions = await generateStructuredQuestions(
      model,
      `Gere um quiz usando exclusivamente as fontes fornecidas. Não invente fatos. Cada questão deve citar ao menos uma SOURCE válida. Retorne um objeto com três arrays: multipleChoice com EXATAMENTE ${expected.multipleChoice} itens, trueFalse com EXATAMENTE ${expected.trueFalse} itens e open com EXATAMENTE ${expected.open} itens. Não mova questões entre os arrays. Preencha com null os campos que não se aplicam ao tipo de questão e explicações de alternativas ausentes.\n\nTítulo: ${quiz.title}\nDescrição: ${quiz.description ?? ""}\nDisciplina: ${quiz.subject?.name ?? "Geral"}\nEscolaridade: ${version.educationLevel}\nDificuldade: ${version.difficulty}\n\nFONTES:\n${contextParts.join("\n\n")}`,
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
    await prisma.$transaction([
      prisma.quiz.update({ where: { id: quiz.id }, data: { status: "DRAFT" } }),
      prisma.quizVersion.update({
        where: { id: version.id },
        data: { status: "FAILED" },
      }),
      prisma.aiRun.update({
        where: { id: run.id },
        data: {
          status: RunStatus.FAILED,
          errorMessage: message,
          completedAt: new Date(),
        },
      }),
    ]);
    throw error;
  }
}
