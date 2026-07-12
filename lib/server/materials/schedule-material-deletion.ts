import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { backgroundJobs, fileAssets, materials } from "@/lib/server/db/schema";

export type ScheduleMaterialDeletionResult = { status: "not_found" } | { status: "processing" } | { status: "scheduled"; material: { id: string; fileId: string } };

export async function scheduleMaterialDeletion(userId: string, materialId: string): Promise<ScheduleMaterialDeletionResult> {
  const [material] = await db.select({ id: materials.id, fileId: materials.fileId, processingStatus: materials.processingStatus }).from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.ownerId, userId), isNull(materials.deletedAt))).limit(1);
  if (!material) return { status: "not_found" };
  if (material.processingStatus === "PROCESSING") return { status: "processing" };
  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.update(materials).set({ deletedAt: now, updatedAt: now }).where(eq(materials.id, material.id));
    await transaction.update(fileAssets).set({ status: "DELETE_PENDING" }).where(eq(fileAssets.id, material.fileId));
    await transaction.update(backgroundJobs).set({ status: "CANCELLED", lockedAt: null, lockedBy: null, updatedAt: now })
      .where(and(eq(backgroundJobs.targetType, "Material"), eq(backgroundJobs.targetId, material.id), eq(backgroundJobs.kind, "PROCESS_MATERIAL"), inArray(backgroundJobs.status, ["PENDING", "FAILED"])));
    await transaction.insert(backgroundJobs).values({ userId, kind: "DELETE_BLOB", targetType: "FileAsset", targetId: material.fileId, idempotencyKey: `delete-blob:${material.fileId}`, updatedAt: now }).onConflictDoNothing({ target: backgroundJobs.idempotencyKey });
  });
  return { status: "scheduled", material: { id: material.id, fileId: material.fileId } };
}
