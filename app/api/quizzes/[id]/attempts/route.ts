import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";

export async function POST(_request: Request, context: RouteContext<"/api/quizzes/[id]/attempts">): Promise<Response> {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const quiz = await prisma.quiz.findFirst({ where: { id, ownerId: user.id, deletedAt: null }, include: { currentVersion: true } });
  if (!quiz?.currentVersion || !["READY", "PUBLISHED"].includes(quiz.currentVersion.status)) return Response.json({ data: null, error: "O quiz ainda não está pronto." }, { status: 409 });
  const existing = await prisma.quizAttempt.findFirst({ where: { userId: user.id, quizId: quiz.id, quizVersionId: quiz.currentVersion.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" } });
  if (existing) return Response.json({ data: existing, error: null });
  const attempt = await prisma.quizAttempt.create({ data: { userId: user.id, quizId: quiz.id, quizVersionId: quiz.currentVersion.id } });
  return Response.json({ data: attempt, error: null }, { status: 201 });
}
