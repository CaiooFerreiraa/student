import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { nextReviewInterval } from "@/domain/quiz/review-schedule";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { attemptAnswers, quizAttempts, quizReviewSchedules } from "@/lib/server/db/schema";
import { hasAiConfiguration } from "@/lib/server/env";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { gradeOpenAnswers } from "@/lib/server/quizzes/grade-open-answers";

export const POST = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/attempts/[id]/submit">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const attempt = await db.query.quizAttempts.findFirst({
    where: and(eq(quizAttempts.id, id), eq(quizAttempts.userId, user.id), eq(quizAttempts.status, "IN_PROGRESS")),
    with: { attemptAnswers: { with: { questionOption: true } }, quizVersion: { with: { questions: true } } },
  });
  if (!attempt) return Response.json({ data: null, error: "Tentativa não encontrada ou já enviada." }, { status: 409 });

  const answerByQuestion = new Map(attempt.attemptAnswers.map((answer) => [answer.questionId, answer]));
  let score = 0;
  let maximumScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  const gradedAnswers: Array<{ id: string; isCorrect: boolean; points: number }> = [];
  for (const question of attempt.quizVersion.questions) {
    maximumScore += question.points;
    const answer = answerByQuestion.get(question.id);
    if (!answer) { unansweredCount++; continue; }
    if (question.type === "OPEN") continue;
    const isCorrect = question.type === "MULTIPLE_CHOICE" ? Boolean(answer.questionOption?.isCorrect) : answer.booleanAnswer === question.correctBoolean;
    if (isCorrect) { score += question.points; correctCount++; } else incorrectCount++;
    gradedAnswers.push({ id: answer.id, isCorrect, points: isCorrect ? question.points : 0 });
  }
  const submittedAt = new Date();
  const durationSeconds = Math.max(0, Math.floor((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000));
  const percentage = maximumScore ? score / maximumScore * 100 : 0;
  const intervalDays = nextReviewInterval(percentage);
  await db.transaction(async (transaction) => {
    for (const answer of gradedAnswers) {
      await transaction.update(attemptAnswers).set({ isCorrect: answer.isCorrect, pointsAwarded: answer.points.toFixed(2), gradedBy: "SYSTEM", gradingStatus: "GRADED", gradedAt: submittedAt }).where(eq(attemptAnswers.id, answer.id));
    }
    await transaction.update(quizAttempts).set({ status: "SUBMITTED", submittedAt, durationSeconds, score: score.toFixed(2), maximumScore: maximumScore.toFixed(2), percentage: percentage.toFixed(2), correctCount, incorrectCount, unansweredCount }).where(eq(quizAttempts.id, attempt.id));
    await transaction.insert(quizReviewSchedules).values({ userId: user.id, quizId: attempt.quizId, lastAttemptId: attempt.id, nextReviewAt: new Date(Date.now() + intervalDays * 86_400_000), intervalDays, repetitionCount: 1, updatedAt: submittedAt }).onConflictDoUpdate({ target: [quizReviewSchedules.userId, quizReviewSchedules.quizId], set: { lastAttemptId: attempt.id, nextReviewAt: new Date(Date.now() + intervalDays * 86_400_000), intervalDays, repetitionCount: sql`${quizReviewSchedules.repetitionCount} + 1`, status: "ACTIVE", updatedAt: submittedAt } });
  });
  const submitted = await db.query.quizAttempts.findFirst({ where: eq(quizAttempts.id, attempt.id), with: { attemptAnswers: true } });
  const answers = submitted?.attemptAnswers ?? [];
  if (answers.some((answer) => answer.gradingStatus === "PENDING") && hasAiConfiguration()) after(() => gradeOpenAnswers(user.id, attempt.id));
  return Response.json({ data: submitted ? { ...submitted, answers } : null, error: null });
});
