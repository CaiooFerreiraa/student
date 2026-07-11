import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { AiFeature, QuestionType, RunStatus } from "@/generated/prisma/enums";
import { getAiEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

const generatedQuizSchema = z.object({
  questions: z.array(z.object({
    type: z.enum(QuestionType),
    statement: z.string().min(10),
    explanation: z.string().min(10),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    points: z.number().int().min(1).max(100),
    options: z.array(z.object({ content: z.string().min(1), isCorrect: z.boolean(), explanation: z.string().optional() })).optional(),
    correctBoolean: z.boolean().optional(),
    modelAnswer: z.string().optional(),
    gradingRubric: z.object({ criteria: z.array(z.string()) }).optional(),
    sourceKeys: z.array(z.string()).min(1),
  })),
});

export const QUIZ_GENERATION_PROMPT_VERSION = "quiz-generation-v1";

type Distribution = { multipleChoice: number; trueFalse: number; open: number };

function distribution(value: unknown): Distribution {
  return z.object({ multipleChoice: z.number().int(), trueFalse: z.number().int(), open: z.number().int() }).parse(value);
}

function validateGeneratedQuestions(result: z.infer<typeof generatedQuizSchema>, expected: Distribution): void {
  const counts = { multipleChoice: 0, trueFalse: 0, open: 0 };
  for (const question of result.questions) {
    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      counts.multipleChoice++;
      if (!question.options || question.options.length < 2 || question.options.filter((option) => option.isCorrect).length !== 1) throw new Error("Questão de múltipla escolha inválida.");
    } else if (question.type === QuestionType.TRUE_FALSE) {
      counts.trueFalse++;
      if (question.correctBoolean === undefined) throw new Error("Questão verdadeiro/falso sem gabarito.");
    } else {
      counts.open++;
      if (!question.modelAnswer || !question.gradingRubric) throw new Error("Questão aberta sem resposta-modelo ou rubrica.");
    }
  }
  if (counts.multipleChoice !== expected.multipleChoice || counts.trueFalse !== expected.trueFalse || counts.open !== expected.open) {
    throw new Error("A distribuição de questões gerada não corresponde à configuração do quiz.");
  }
}

export async function generateQuizVersion(userId: string, quizId: string): Promise<void> {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, ownerId: userId, deletedAt: null },
    include: {
      subject: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { materials: { include: { material: true } } } },
    },
  });
  const version = quiz?.versions[0];
  if (!quiz || !version) throw new Error("Quiz não encontrado.");
  const expected = distribution(version.questionDistribution);
  const materialIds = version.materials.map((entry) => entry.materialId);
  if (materialIds.length === 0) throw new Error("Selecione ao menos um material para gerar o quiz.");

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
    contextParts.push(`[${key}] Material: ${chunk.material.title}; página: ${chunk.pageStart ?? "não informada"}\n${chunk.content}`);
    usedCharacters += chunk.content.length;
  }
  if (!contextParts.length) throw new Error("Os materiais ainda não possuem texto processado.");

  const aiEnv = getAiEnv();
  const run = await prisma.aiRun.create({ data: { userId, feature: AiFeature.QUIZ_GENERATION, targetType: "QuizVersion", targetId: version.id, status: RunStatus.RUNNING, model: aiEnv.OPENAI_CHAT_MODEL, promptVersion: QUIZ_GENERATION_PROMPT_VERSION } });
  await prisma.$transaction([
    prisma.quiz.update({ where: { id: quiz.id }, data: { status: "GENERATING" } }),
    prisma.quizVersion.update({ where: { id: version.id }, data: { status: "GENERATING", generationModel: aiEnv.OPENAI_CHAT_MODEL, promptVersion: QUIZ_GENERATION_PROMPT_VERSION } }),
  ]);

  try {
    const model = new ChatOpenAI({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_CHAT_MODEL });
    const structured = model.withStructuredOutput(generatedQuizSchema, { name: "generated_quiz" });
    const result = await structured.invoke(`Gere um quiz usando exclusivamente as fontes fornecidas. Não invente fatos. Cada questão deve citar ao menos uma SOURCE válida.\n\nTítulo: ${quiz.title}\nDescrição: ${quiz.description ?? ""}\nDisciplina: ${quiz.subject?.name ?? "Geral"}\nEscolaridade: ${version.educationLevel}\nDificuldade: ${version.difficulty}\nDistribuição obrigatória: ${JSON.stringify(expected)}\n\nFONTES:\n${contextParts.join("\n\n")}`);
    validateGeneratedQuestions(result, expected);

    await prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { quizVersionId: version.id } });
      for (const [position, question] of result.questions.entries()) {
        const created = await tx.question.create({
          data: {
            quizVersionId: version.id,
            position: position + 1,
            type: question.type,
            statement: question.statement,
            explanation: question.explanation,
            difficulty: question.difficulty,
            points: question.points,
            correctBoolean: question.correctBoolean,
            modelAnswer: question.modelAnswer,
            gradingRubric: question.gradingRubric,
            options: question.options ? { create: question.options.map((option, optionIndex) => ({ position: optionIndex + 1, content: option.content, isCorrect: option.isCorrect, explanation: option.explanation })) } : undefined,
          },
        });
        for (const key of new Set(question.sourceKeys)) {
          const source = sourceMap.get(key);
          if (!source) throw new Error(`Fonte inválida retornada pelo modelo: ${key}`);
          await tx.questionSource.create({ data: { questionId: created.id, chunkId: source.id, pageStart: source.pageStart, pageEnd: source.pageEnd, excerpt: source.content.slice(0, 500) } });
        }
      }
      const totalPoints = result.questions.reduce((sum, question) => sum + question.points, 0);
      await tx.quizVersion.update({ where: { id: version.id }, data: { status: "READY", totalPoints } });
      await tx.quiz.update({ where: { id: quiz.id }, data: { status: "READY", currentVersionId: version.id } });
      await tx.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.SUCCEEDED, completedAt: new Date() } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar quiz.";
    await prisma.$transaction([
      prisma.quiz.update({ where: { id: quiz.id }, data: { status: "DRAFT" } }),
      prisma.quizVersion.update({ where: { id: version.id }, data: { status: "FAILED" } }),
      prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.FAILED, errorMessage: message, completedAt: new Date() } }),
    ]);
    throw error;
  }
}
