import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";

export const GET = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/essays/submissions/[id]">): Promise<Response> => {
  const user = await getCurrentUser(); const { id } = await context.params;
  const submission = await prisma.essaySubmission.findFirst({ where: { id, userId: user.id }, include: { assignment: true, files: { include: { file: { select: { id: true, originalName: true, contentType: true } } }, orderBy: { position: "asc" } }, transcriptions: { orderBy: { versionNumber: "desc" }, take: 1 }, finalEvaluation: { include: { scores: { include: { criterion: true }, orderBy: { criterion: { position: "asc" } } } } } } });
  if (!submission) return Response.json({ data: null, error: "Submissão não encontrada." }, { status: 404 });
  return Response.json({ data: submission, error: null });
});
