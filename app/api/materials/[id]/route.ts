import { after } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasBlobConfiguration } from "@/lib/server/env";
import { deleteMaterialBlob } from "@/lib/server/materials/delete-material";
import { prisma } from "@/lib/server/prisma";

export async function DELETE(_request: Request, context: RouteContext<"/api/materials/[id]">): Promise<Response> {
  const user = await getCurrentUser(); const { id } = await context.params;
  const material = await prisma.material.findFirst({ where: { id, ownerId: user.id, deletedAt: null }, include: { file: true } });
  if (!material) return Response.json({ data: null, error: "Material não encontrado." }, { status: 404 });
  await prisma.$transaction([
    prisma.material.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.fileAsset.update({ where: { id: material.fileId }, data: { status: "DELETE_PENDING" } }),
    prisma.backgroundJob.create({ data: { userId: user.id, kind: "DELETE_BLOB", targetType: "FileAsset", targetId: material.fileId, idempotencyKey: `delete-blob:${material.fileId}` } }),
  ]);
  if (hasBlobConfiguration()) after(() => deleteMaterialBlob(user.id, id));
  return new Response(null, { status: 204 });
}
