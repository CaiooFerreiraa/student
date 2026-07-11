import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const materials = await prisma.material.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "desc" }, include: { file: true, subject: true, _count: { select: { chunks: true } } } });
  return Response.json({ data: materials.map((material) => ({ id: material.id, title: material.title, type: material.type, status: material.processingStatus, size: Number(material.file.byteSize), subject: material.subject?.name ?? "Sem matéria", pageCount: material.pageCount, chunkCount: material._count.chunks, error: material.processingError, createdAt: material.createdAt.toISOString() })), error: null });
});
