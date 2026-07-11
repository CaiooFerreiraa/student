import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";

const CREATE_MANY_BATCH_SIZE = 500;

export type MaterialChunkWrite = Omit<
  Prisma.MaterialChunkCreateManyInput,
  "id" | "materialId" | "createdAt" | "embedding"
>;

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export async function replaceMaterialChunks(materialId: string, chunks: MaterialChunkWrite[]): Promise<void> {
  const createOperations = batches(chunks, CREATE_MANY_BATCH_SIZE).map((batch) =>
    prisma.materialChunk.createMany({
      data: batch.map((chunk) => ({ ...chunk, materialId })),
    }),
  );

  await prisma.$transaction([
    prisma.materialChunk.deleteMany({ where: { materialId } }),
    ...createOperations,
  ]);
}
