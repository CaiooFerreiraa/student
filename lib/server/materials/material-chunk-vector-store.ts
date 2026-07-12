import "server-only";
import { and, cosineDistance, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { materialChunks, materials } from "@/lib/server/db/schema";

const EMBEDDING_DIMENSIONS = 1_536;
const EMBEDDING_UPDATE_BATCH_SIZE = 100;
export type MaterialChunkSemanticMatch = { materialId: string; materialTitle: string; content: string; pageStart: number | null; pageEnd: number | null; similarity: number };
type ChunkEmbedding = { id: string; embedding: number[] };

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function validateEmbedding(embedding: number[]): number[] {
  if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`O embedding deve conter ${EMBEDDING_DIMENSIONS} números válidos.`);
  }
  return embedding;
}

export async function searchMaterialChunksBySimilarity(input: { ownerId: string; embedding: number[]; limit: number }): Promise<MaterialChunkSemanticMatch[]> {
  const distance = cosineDistance(materialChunks.embedding, validateEmbedding(input.embedding));
  const rows = await db.select({
    materialId: materials.id,
    materialTitle: materials.title,
    content: materialChunks.content,
    pageStart: materialChunks.pageStart,
    pageEnd: materialChunks.pageEnd,
    similarity: sql<number>`1 - (${distance})`,
  }).from(materialChunks).innerJoin(materials, eq(materialChunks.materialId, materials.id))
    .where(and(eq(materials.ownerId, input.ownerId), isNotNull(materialChunks.embedding), isNotNull(materials.processedAt)))
    .orderBy(desc(sql`1 - (${distance})`)).limit(input.limit);
  return rows.map((row) => ({ ...row, similarity: Number(row.similarity) }));
}

export async function setMaterialChunkEmbeddings(chunks: ChunkEmbedding[]): Promise<void> {
  if (chunks.length === 0) return;
  const validated = chunks.map((chunk) => ({
    id: chunk.id,
    embedding: `[${validateEmbedding(chunk.embedding).join(",")}]`,
  }));

  await db.transaction(async (transaction) => {
    for (const batch of batches(validated, EMBEDDING_UPDATE_BATCH_SIZE)) {
      await transaction.execute(sql`
        update ${materialChunks}
        set "embedding" = batch.embedding::vector
        from jsonb_to_recordset(${JSON.stringify(batch)}::jsonb) as batch(id uuid, embedding text)
        where ${materialChunks.id} = batch.id
      `);
    }
  });
}
