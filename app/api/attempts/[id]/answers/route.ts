import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { GradingStatus } from "@/domain/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { attemptAnswers, questionOptions, questions, quizAttempts } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const schema = z.object({ questionId: z.string().uuid(), selectedOptionId: z.string().uuid().nullable().optional(), booleanAnswer: z.boolean().nullable().optional(), textAnswer: z.string().max(10_000).nullable().optional() });

export const PUT = withApiErrorBoundary(async (request: Request, context: RouteContext<"/api/attempts/[id]/answers">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const input = schema.parse(await request.json());
  const [attempt] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, id), eq(quizAttempts.userId, user.id), eq(quizAttempts.status, "IN_PROGRESS"))).limit(1);
  if (!attempt) return Response.json({ data: null, error: "Tentativa não encontrada ou já finalizada." }, { status: 409 });
  const [question] = await db.select().from(questions).where(and(eq(questions.id, input.questionId), eq(questions.quizVersionId, attempt.quizVersionId))).limit(1);
  if (!question) return Response.json({ data: null, error: "Questão inválida." }, { status: 400 });
  if (question.type === "MULTIPLE_CHOICE") {
    if (!input.selectedOptionId) return Response.json({ data: null, error: "Selecione uma alternativa." }, { status: 400 });
    const [option] = await db.select({ id: questionOptions.id }).from(questionOptions).where(and(eq(questionOptions.id, input.selectedOptionId), eq(questionOptions.questionId, question.id))).limit(1);
    if (!option) return Response.json({ data: null, error: "Alternativa inválida." }, { status: 400 });
  }
  if (question.type === "TRUE_FALSE" && input.booleanAnswer == null) return Response.json({ data: null, error: "Informe verdadeiro ou falso." }, { status: 400 });
  const gradingStatus = question.type === "OPEN" ? GradingStatus.PENDING : GradingStatus.NOT_REQUIRED;
  const values = { selectedOptionId: question.type === "MULTIPLE_CHOICE" ? input.selectedOptionId : null, booleanAnswer: question.type === "TRUE_FALSE" ? input.booleanAnswer : null, textAnswer: question.type === "OPEN" ? input.textAnswer : null, gradingStatus, answeredAt: new Date() };
  const [answer] = await db.insert(attemptAnswers).values({ attemptId: attempt.id, questionId: question.id, ...values }).onConflictDoUpdate({ target: [attemptAnswers.attemptId, attemptAnswers.questionId], set: values }).returning();
  return Response.json({ data: answer, error: null });
});
