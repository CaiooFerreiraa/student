import "server-only";
import { and, eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/lib/server/db";
import { backgroundJobs, fileAssets, materials } from "@/lib/server/db/schema";
import { getBlobEnv } from "@/lib/server/env";

export async function deleteMaterialBlob(userId: string, materialId: string): Promise<void> {
  const [row] = await db.select({ material: materials, file: fileAssets }).from(materials).innerJoin(fileAssets, eq(materials.fileId, fileAssets.id))
    .where(and(eq(materials.id, materialId), eq(materials.ownerId, userId))).limit(1);
  if (!row || row.file.status === "DELETED") return;
  try {
    await del(row.file.pathname, { token: getBlobEnv().BLOB_READ_WRITE_TOKEN });
    const now = new Date();
    await db.transaction(async (transaction) => {
      await transaction.update(fileAssets).set({ status: "DELETED", deletedAt: now }).where(eq(fileAssets.id, row.file.id));
      await transaction.update(backgroundJobs).set({ status: "SUCCEEDED", lockedAt: null, updatedAt: now }).where(and(eq(backgroundJobs.targetType, "FileAsset"), eq(backgroundJobs.targetId, row.file.id), eq(backgroundJobs.kind, "DELETE_BLOB")));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao remover Blob.";
    await db.update(backgroundJobs).set({ status: "FAILED", lastError: message, updatedAt: new Date() }).where(and(eq(backgroundJobs.targetType, "FileAsset"), eq(backgroundJobs.targetId, row.file.id), eq(backgroundJobs.kind, "DELETE_BLOB")));
  }
}
