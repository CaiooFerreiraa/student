import "server-only";
import { prisma } from "@/lib/server/prisma";

export type ScheduleMaterialDeletionResult =
  | { status: "not_found" }
  | { status: "processing" }
  | { status: "scheduled"; material: { id: string; fileId: string } };

export async function scheduleMaterialDeletion(userId: string, materialId: string): Promise<ScheduleMaterialDeletionResult> {
  const material = await prisma.material.findFirst({
    where: { id: materialId, ownerId: userId, deletedAt: null },
    select: { id: true, fileId: true, processingStatus: true },
  });
  if (!material) return { status: "not_found" };
  if (material.processingStatus === "PROCESSING") return { status: "processing" };

  await prisma.$transaction([
    prisma.material.update({ where: { id: material.id }, data: { deletedAt: new Date() } }),
    prisma.fileAsset.update({ where: { id: material.fileId }, data: { status: "DELETE_PENDING" } }),
    prisma.backgroundJob.updateMany({
      where: {
        targetType: "Material",
        targetId: material.id,
        kind: "PROCESS_MATERIAL",
        status: { in: ["PENDING", "FAILED"] },
      },
      data: { status: "CANCELLED", lockedAt: null, lockedBy: null },
    }),
    prisma.backgroundJob.create({
      data: {
        userId,
        kind: "DELETE_BLOB",
        targetType: "FileAsset",
        targetId: material.fileId,
        idempotencyKey: `delete-blob:${material.fileId}`,
      },
    }),
  ]);

  return { status: "scheduled", material: { id: material.id, fileId: material.fileId } };
}
