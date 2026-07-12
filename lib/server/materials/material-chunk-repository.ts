import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { materialChunks } from "@/lib/server/db/schema";

const CREATE_MANY_BATCH_SIZE = 500;
export type MaterialChunkWrite = Omit<typeof materialChunks.$inferInsert, "id" | "materialId" | "createdAt" | "embedding">;

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function replaceMaterialChunks(materialId: string, chunks: MaterialChunkWrite[]): Promise<void> {
  await db.transaction(async (transaction) => {
    await transaction.delete(materialChunks).where(eq(materialChunks.materialId, materialId));
    for (const batch of batches(chunks, CREATE_MANY_BATCH_SIZE)) {
      if (batch.length > 0) await transaction.insert(materialChunks).values(batch.map((chunk) => ({ ...chunk, materialId })));
    }
  });
}
