import { desc } from "drizzle-orm";
import { createQuizSchema } from "@/domain/quiz/quiz-config";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { quizAttempts, quizzes } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { createQuiz } from "@/lib/server/quizzes/create-quiz";

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const rows = await db.query.quizzes.findMany({ where: (table, { and, eq, isNull }) => and(eq(table.ownerId, user.id), isNull(table.deletedAt)), orderBy: [desc(quizzes.updatedAt)], with: { subject: true, quizVersion: true, quizAttempts: { where: (table, { eq }) => eq(table.status, "SUBMITTED"), orderBy: [desc(quizAttempts.submittedAt)], limit: 1 } } });
  return Response.json({ data: rows.map((quiz) => ({ ...quiz, currentVersion: quiz.quizVersion, attempts: quiz.quizAttempts })), error: null });
});

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  const quiz = await createQuiz(user.id, createQuizSchema.parse(await request.json()));
  return Response.json({ data: quiz, error: null }, { status: 201 });
});
