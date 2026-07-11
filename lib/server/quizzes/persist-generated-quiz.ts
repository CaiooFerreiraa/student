import "server-only";
import { randomUUID } from "node:crypto";
import type { GeneratedQuestion } from "@/domain/quiz/generated-quiz";
import { RunStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/server/prisma";

export type QuestionSourceReference = {
  id: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
};

export async function persistGeneratedQuiz(input: {
  quizId: string;
  versionId: string;
  aiRunId: string;
  questions: GeneratedQuestion[];
  sources: Map<string, QuestionSourceReference>;
}): Promise<void> {
  const questions = input.questions.map((question, index) => ({
    id: randomUUID(),
    value: question,
    position: index + 1,
  }));

  const questionRows = questions.map(({ id, value, position }) => ({
    id,
    quizVersionId: input.versionId,
    position,
    type: value.type,
    statement: value.statement,
    explanation: value.explanation,
    difficulty: value.difficulty,
    points: value.points,
    correctBoolean: value.correctBoolean ?? undefined,
    modelAnswer: value.modelAnswer ?? undefined,
    gradingRubric: value.gradingRubric ?? undefined,
  }));
  const optionRows = questions.flatMap(({ id, value }) =>
    (value.options ?? []).map((option, index) => ({
      questionId: id,
      position: index + 1,
      content: option.content,
      isCorrect: option.isCorrect,
      explanation: option.explanation ?? undefined,
    })),
  );
  const sourceRows = questions.flatMap(({ id, value }) =>
    [...new Set(value.sourceKeys)].map((sourceKey) => {
      const source = input.sources.get(sourceKey);
      if (!source)
        throw new Error(`Fonte inválida retornada pelo modelo: ${sourceKey}`);
      return {
        questionId: id,
        chunkId: source.id,
        pageStart: source.pageStart,
        pageEnd: source.pageEnd,
        excerpt: source.content.slice(0, 500),
      };
    }),
  );
  const totalPoints = input.questions.reduce(
    (sum, question) => sum + question.points,
    0,
  );

  await prisma.$transaction([
    prisma.question.deleteMany({ where: { quizVersionId: input.versionId } }),
    prisma.question.createMany({ data: questionRows }),
    ...(optionRows.length
      ? [prisma.questionOption.createMany({ data: optionRows })]
      : []),
    prisma.questionSource.createMany({ data: sourceRows }),
    prisma.quizVersion.update({
      where: { id: input.versionId },
      data: { status: "READY", totalPoints },
    }),
    prisma.quiz.update({
      where: { id: input.quizId },
      data: { status: "READY", currentVersionId: input.versionId },
    }),
    prisma.aiRun.update({
      where: { id: input.aiRunId },
      data: { status: RunStatus.SUCCEEDED, completedAt: new Date() },
    }),
  ]);
}
