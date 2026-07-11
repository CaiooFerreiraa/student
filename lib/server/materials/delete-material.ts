import "server-only";
import { del } from "@vercel/blob";
import { getBlobEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

export async function deleteMaterialBlob(userId: string, materialId: string): Promise<void> {
  const material = await prisma.material.findFirst({ where: { id: materialId, ownerId: userId }, include: { file: true } });
  if (!material || material.file.status === "DELETED") return;
  const env = getBlobEnv();
  try {
    await del(material.file.pathname, { token: env.BLOB_READ_WRITE_TOKEN });
    await prisma.$transaction([
      prisma.fileAsset.update({ where: { id: material.file.id }, data: { status: "DELETED", deletedAt: new Date() } }),
      prisma.backgroundJob.updateMany({ where: { targetType: "FileAsset", targetId: material.file.id, kind: "DELETE_BLOB" }, data: { status: "SUCCEEDED", lockedAt: null } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao remover Blob.";
    await prisma.backgroundJob.updateMany({ where: { targetType: "FileAsset", targetId: material.file.id, kind: "DELETE_BLOB" }, data: { status: "FAILED", lastError: message } });
  }
}
