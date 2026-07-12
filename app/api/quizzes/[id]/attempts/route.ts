import { and, desc, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { quizAttempts, quizzes } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

export const POST = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/quizzes/[id]/attempts">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const quiz = await db.query.quizzes.findFirst({ where: and(eq(quizzes.id, id), eq(quizzes.ownerId, user.id), isNull(quizzes.deletedAt)), with: { quizVersion: true } });
  if (!quiz?.quizVersion || !["READY", "PUBLISHED"].includes(quiz.quizVersion.status)) return Response.json({ data: null, error: "O quiz ainda não está pronto." }, { status: 409 });
  const [existing] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.userId, user.id), eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.quizVersionId, quiz.quizVersion.id), eq(quizAttempts.status, "IN_PROGRESS"))).orderBy(desc(quizAttempts.startedAt)).limit(1);
  if (existing) return Response.json({ data: existing, error: null });
  const [attempt] = await db.insert(quizAttempts).values({ userId: user.id, quizId: quiz.id, quizVersionId: quiz.quizVersion.id }).returning();
  return Response.json({ data: attempt, error: null }, { status: 201 });
});
