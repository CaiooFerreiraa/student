import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";

const updateSchema = z.object({ title: z.string().trim().min(3).max(160).optional(), description: z.string().trim().max(1000).nullable().optional(), status: z.enum(["DRAFT", "ARCHIVED"]).optional() });

export const GET = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/quizzes/[id]">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const quiz = await prisma.quiz.findFirst({ where: { id, ownerId: user.id, deletedAt: null }, include: { subject: true, versions: { orderBy: { versionNumber: "desc" }, include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } }, sources: true } } } } } });
  if (!quiz) return Response.json({ data: null, error: "Quiz não encontrado." }, { status: 404 });
  return Response.json({ data: quiz, error: null });
});

export const PATCH = withApiErrorBoundary(async (request: Request, context: RouteContext<"/api/quizzes/[id]">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const input = updateSchema.parse(await request.json());
  const quiz = await prisma.quiz.findFirst({ where: { id, ownerId: user.id, deletedAt: null } });
  if (!quiz) return Response.json({ data: null, error: "Quiz não encontrado." }, { status: 404 });
  const updated = await prisma.quiz.update({ where: { id }, data: input });
  return Response.json({ data: updated, error: null });
});

export const DELETE = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/quizzes/[id]">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const quiz = await prisma.quiz.findFirst({ where: { id, ownerId: user.id, deletedAt: null } });
  if (!quiz) return Response.json({ data: null, error: "Quiz não encontrado." }, { status: 404 });
  await prisma.quiz.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
  return new Response(null, { status: 204 });
});
