import "server-only";
import { prisma } from "@/lib/server/prisma";

export async function listAttemptHistory(userId: string, quizId?: string) {
  return prisma.quizAttempt.findMany({
    where: { userId, status: "SUBMITTED", ...(quizId ? { quizId } : {}) },
    orderBy: { submittedAt: "desc" },
    include: {
      quiz: {
        select: { id: true, title: true, subject: { select: { name: true } } },
      },
      quizVersion: {
        select: { versionNumber: true, requestedQuestionCount: true },
      },
    },
  });
}

export async function getAttemptReview(userId: string, attemptId: string) {
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId, status: "SUBMITTED" },
    include: {
      quiz: {
        select: { id: true, title: true, subject: { select: { name: true } } },
      },
      quizVersion: {
        include: {
          questions: {
            orderBy: { position: "asc" },
            include: {
              options: { orderBy: { position: "asc" } },
              sources: {
                include: {
                  chunk: { include: { material: { select: { title: true } } } },
                },
              },
            },
          },
        },
      },
      answers: { include: { selectedOption: true } },
    },
  });
  if (!attempt) return null;

  const answers = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );
  return {
    ...attempt,
    questions: attempt.quizVersion.questions.map((question) => ({
      ...question,
      answer: answers.get(question.id) ?? null,
    })),
  };
}
