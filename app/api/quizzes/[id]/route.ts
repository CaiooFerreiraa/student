import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { questionOptions, questions, quizzes, quizVersions } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const updateSchema = z.object({ title: z.string().trim().min(3).max(160).optional(), description: z.string().trim().max(1000).nullable().optional(), status: z.enum(["DRAFT", "ARCHIVED"]).optional() });

export const GET = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/quizzes/[id]">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const quiz = await db.query.quizzes.findFirst({ where: and(eq(quizzes.id, id), eq(quizzes.ownerId, user.id), isNull(quizzes.deletedAt)), with: { subject: true, quizVersions: { orderBy: [desc(quizVersions.versionNumber)], with: { questions: { orderBy: [asc(questions.position)], with: { questionOptions: { orderBy: [asc(questionOptions.position)] }, questionSources: true } } } } } });
  if (!quiz) return Response.json({ data: null, error: "Quiz não encontrado." }, { status: 404 });
  return Response.json({ data: { ...quiz, versions: quiz.quizVersions.map((version) => ({ ...version, questions: version.questions.map((question) => ({ ...question, options: question.questionOptions, sources: question.questionSources })) })) }, error: null });
});

export const PATCH = withApiErrorBoundary(async (request: Request, context: RouteContext<"/api/quizzes/[id]">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const input = updateSchema.parse(await request.json());
  const [updated] = await db.update(quizzes).set({ ...input, updatedAt: new Date() }).where(and(eq(quizzes.id, id), eq(quizzes.ownerId, user.id), isNull(quizzes.deletedAt))).returning();
  if (!updated) return Response.json({ data: null, error: "Quiz não encontrado." }, { status: 404 });
  return Response.json({ data: updated, error: null });
});

export const DELETE = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/quizzes/[id]">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const [deleted] = await db.update(quizzes).set({ deletedAt: new Date(), status: "ARCHIVED", updatedAt: new Date() }).where(and(eq(quizzes.id, id), eq(quizzes.ownerId, user.id), isNull(quizzes.deletedAt))).returning({ id: quizzes.id });
  if (!deleted) return Response.json({ data: null, error: "Quiz não encontrado." }, { status: 404 });
  return new Response(null, { status: 204 });
});
