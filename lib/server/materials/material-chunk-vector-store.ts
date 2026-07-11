import "server-only";
import {
  searchMaterialChunks as searchMaterialChunksQuery,
  setMaterialChunkEmbeddings as setMaterialChunkEmbeddingsQuery,
} from "@/generated/prisma/sql";
import { prisma } from "@/lib/server/prisma";

const EMBEDDING_DIMENSIONS = 1_536;

export type MaterialChunkSemanticMatch = {
  materialId: string;
  materialTitle: string;
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
  similarity: number;
};

type ChunkEmbedding = {
  id: string;
  embedding: number[];
};

function serializeEmbedding(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error(`O embedding deve conter ${EMBEDDING_DIMENSIONS} números válidos.`);
  }

  return `[${embedding.join(",")}]`;
}

export async function searchMaterialChunksBySimilarity(input: {
  ownerId: string;
  embedding: number[];
  limit: number;
}): Promise<MaterialChunkSemanticMatch[]> {
  const rows = await prisma.$queryRawTyped(
    searchMaterialChunksQuery(input.ownerId, serializeEmbedding(input.embedding), input.limit),
  );

  return rows.map((row) => ({
    ...row,
    similarity: row.similarity ?? 0,
  }));
}

export async function setMaterialChunkEmbeddings(chunks: ChunkEmbedding[]): Promise<void> {
  if (chunks.length === 0) return;

  await prisma.$queryRawTyped(
    setMaterialChunkEmbeddingsQuery(
      chunks.map((chunk) => chunk.id),
      chunks.map((chunk) => serializeEmbedding(chunk.embedding)),
    ),
  );
}
