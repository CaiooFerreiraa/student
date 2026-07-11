import { after } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { hasAiConfiguration } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { gradeOpenAnswers } from "@/lib/server/quizzes/grade-open-answers";
import { nextReviewInterval } from "@/domain/quiz/review-schedule";

export const POST = withApiErrorBoundary(
  async (
    _request: Request,
    context: RouteContext<"/api/attempts/[id]/submit">,
  ): Promise<Response> => {
    const user = await getCurrentUser();
    const { id } = await context.params;
    const attempt = await prisma.quizAttempt.findFirst({
      where: { id, userId: user.id, status: "IN_PROGRESS" },
      include: {
        answers: { include: { selectedOption: true } },
        quizVersion: { include: { questions: true } },
      },
    });
    if (!attempt)
      return Response.json(
        { data: null, error: "Tentativa não encontrada ou já enviada." },
        { status: 409 },
      );
    const answerByQuestion = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer]),
    );
    let score = 0;
    let maximumScore = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    const answerUpdates = [];

    for (const question of attempt.quizVersion.questions) {
      maximumScore += question.points;
      const answer = answerByQuestion.get(question.id);
      if (!answer) {
        unansweredCount++;
        continue;
      }
      if (question.type === "OPEN") continue;
      const isCorrect =
        question.type === "MULTIPLE_CHOICE"
          ? Boolean(answer.selectedOption?.isCorrect)
          : answer.booleanAnswer === question.correctBoolean;
      if (isCorrect) {
        score += question.points;
        correctCount++;
      } else incorrectCount++;
      answerUpdates.push(
        prisma.attemptAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect,
            pointsAwarded: isCorrect ? question.points : 0,
            gradedBy: "SYSTEM",
            gradingStatus: "GRADED",
            gradedAt: new Date(),
          },
        }),
      );
    }
    const submittedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
    );
    const percentage = maximumScore ? (score / maximumScore) * 100 : 0;
    const intervalDays = nextReviewInterval(percentage);
    await prisma.$transaction([
      ...answerUpdates,
      prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUBMITTED",
          submittedAt,
          durationSeconds,
          score,
          maximumScore,
          percentage,
          correctCount,
          incorrectCount,
          unansweredCount,
        },
      }),
      prisma.quizReviewSchedule.upsert({
        where: { userId_quizId: { userId: user.id, quizId: attempt.quizId } },
        update: {
          lastAttemptId: attempt.id,
          nextReviewAt: new Date(Date.now() + intervalDays * 86_400_000),
          intervalDays,
          repetitionCount: { increment: 1 },
          status: "ACTIVE",
        },
        create: {
          userId: user.id,
          quizId: attempt.quizId,
          lastAttemptId: attempt.id,
          nextReviewAt: new Date(Date.now() + intervalDays * 86_400_000),
          intervalDays,
          repetitionCount: 1,
        },
      }),
    ]);
    const submitted = await prisma.quizAttempt.findUnique({
      where: { id: attempt.id },
      include: { answers: true },
    });
    if (
      submitted?.answers.some((answer) => answer.gradingStatus === "PENDING") &&
      hasAiConfiguration()
    )
      after(() => gradeOpenAnswers(user.id, attempt.id));
    return Response.json({ data: submitted, error: null });
  },
);
