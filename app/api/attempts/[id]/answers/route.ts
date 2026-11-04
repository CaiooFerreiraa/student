import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { attemptAnswers, questionOptions, questions, quizAttempts, quizVersions } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { getConfirmedAnswers } from "@/lib/server/quizzes/confirmed-answer";

const schema = z.object({ questionId: z.string().uuid(), selectedOptionId: z.string().uuid().nullable().optional(), booleanAnswer: z.boolean().nullable().optional(), textAnswer: z.string().max(10_000).nullable().optional() });

export const GET = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/attempts/[id]/answers">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const [attempt] = await db.select({ id: quizAttempts.id, revealMode: quizVersions.answerRevealMode }).from(quizAttempts)
    .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.id))
    .where(and(eq(quizAttempts.id, id), eq(quizAttempts.userId, user.id), eq(quizAttempts.status, "IN_PROGRESS"))).limit(1);
  if (!attempt) return Response.json({ data: null, error: "Tentativa não encontrada ou já finalizada." }, { status: 409 });
  const answers = await db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attempt.id));
  const confirmed = answers.filter((answer) => answer.gradingStatus !== "NOT_REQUIRED");
  const drafts = answers.filter((answer) => answer.gradingStatus === "NOT_REQUIRED")
    .map(({ questionId, selectedOptionId, booleanAnswer, textAnswer }) => ({ questionId, selectedOptionId, booleanAnswer, textAnswer }));
  return Response.json({ data: { confirmed: await getConfirmedAnswers(confirmed, attempt.revealMode), drafts }, error: null });
});

export const PUT = withApiErrorBoundary(async (request: Request, context: RouteContext<"/api/attempts/[id]/answers">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const input = schema.parse(await request.json());
  const [attempt] = await db.select({ id: quizAttempts.id, quizVersionId: quizAttempts.quizVersionId, revealMode: quizVersions.answerRevealMode })
    .from(quizAttempts).innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.id))
    .where(and(eq(quizAttempts.id, id), eq(quizAttempts.userId, user.id), eq(quizAttempts.status, "IN_PROGRESS"))).limit(1);
  if (!attempt) return Response.json({ data: null, error: "Tentativa não encontrada ou já finalizada." }, { status: 409 });
  const [question] = await db.select().from(questions).where(and(eq(questions.id, input.questionId), eq(questions.quizVersionId, attempt.quizVersionId))).limit(1);
  if (!question) return Response.json({ data: null, error: "Questão inválida." }, { status: 400 });
  let selectedOption: { id: string; isCorrect: boolean } | undefined;
  if (question.type === "MULTIPLE_CHOICE") {
    if (!input.selectedOptionId) return Response.json({ data: null, error: "Selecione uma alternativa." }, { status: 400 });
    [selectedOption] = await db.select({ id: questionOptions.id, isCorrect: questionOptions.isCorrect }).from(questionOptions).where(and(eq(questionOptions.id, input.selectedOptionId), eq(questionOptions.questionId, question.id))).limit(1);
    if (!selectedOption) return Response.json({ data: null, error: "Alternativa inválida." }, { status: 400 });
  }
  if (question.type === "TRUE_FALSE" && input.booleanAnswer == null) return Response.json({ data: null, error: "Informe verdadeiro ou falso." }, { status: 400 });
  if (question.type === "OPEN" && !input.textAnswer?.trim()) return Response.json({ data: null, error: "Escreva sua resposta." }, { status: 400 });
  const isCorrect = question.type === "OPEN" ? null : question.type === "MULTIPLE_CHOICE" ? selectedOption!.isCorrect : input.booleanAnswer === question.correctBoolean;
  const values = {
    selectedOptionId: question.type === "MULTIPLE_CHOICE" ? input.selectedOptionId : null,
    booleanAnswer: question.type === "TRUE_FALSE" ? input.booleanAnswer : null,
    textAnswer: question.type === "OPEN" ? input.textAnswer : null,
    gradingStatus: question.type === "OPEN" ? "PENDING" as const : "GRADED" as const,
    isCorrect, pointsAwarded: isCorrect === null ? null : (isCorrect ? question.points : 0).toFixed(2),
    gradedBy: question.type === "OPEN" ? null : "SYSTEM" as const,
    gradedAt: question.type === "OPEN" ? null : new Date(),
    answeredAt: new Date(),
  };
  const [inserted] = await db.insert(attemptAnswers).values({ attemptId: attempt.id, questionId: question.id, ...values })
    .onConflictDoNothing({ target: [attemptAnswers.attemptId, attemptAnswers.questionId] }).returning();
  const [existing] = inserted ? [inserted] : await db.select().from(attemptAnswers)
    .where(and(eq(attemptAnswers.attemptId, attempt.id), eq(attemptAnswers.questionId, question.id))).limit(1);
  let answer = existing;
  if (existing?.gradingStatus === "NOT_REQUIRED") {
    const [updated] = await db.update(attemptAnswers).set(values)
      .where(and(eq(attemptAnswers.id, existing.id), eq(attemptAnswers.gradingStatus, "NOT_REQUIRED"))).returning();
    [answer] = updated ? [updated] : await db.select().from(attemptAnswers).where(eq(attemptAnswers.id, existing.id)).limit(1);
  }
  if (!answer) throw new Error("Resposta confirmada não encontrada.");
  if (answer.selectedOptionId !== values.selectedOptionId || answer.booleanAnswer !== values.booleanAnswer || answer.textAnswer !== values.textAnswer) {
    return Response.json({ data: null, error: "Esta questão já foi confirmada." }, { status: 409 });
  }
  return Response.json({ data: (await getConfirmedAnswers([answer], attempt.revealMode))[0], error: null });
});
