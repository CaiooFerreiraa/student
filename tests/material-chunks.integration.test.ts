import { beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let prisma: typeof import("@/lib/server/prisma").prisma;
let replaceMaterialChunks: typeof import("@/lib/server/materials/material-chunk-repository").replaceMaterialChunks;

beforeAll(async () => {
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ prisma } = await import("@/lib/server/prisma"));
  ({ replaceMaterialChunks } = await import("@/lib/server/materials/material-chunk-repository"));
});

describe("persistência em lote de chunks", () => {
  test("substitui centenas de chunks atomicamente no Neon", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const file = await prisma.fileAsset.create({
      data: {
        ownerId: user.id,
        purpose: "MATERIAL",
        status: "AVAILABLE",
        pathname: `users/${user.id}/materials/chunks-${nonce}.txt`,
        url: `https://example.com/chunks-${nonce}.txt`,
        originalName: "chunks.txt",
        contentType: "text/plain",
        byteSize: BigInt(1_024),
      },
    });
    const material = await prisma.material.create({
      data: {
        ownerId: user.id,
        fileId: file.id,
        title: "Teste de chunks",
        type: "TEXT",
        processingStatus: "PROCESSING",
      },
    });

    try {
      const chunks = Array.from({ length: 500 }, (_, position) => ({
        position,
        pageStart: Math.floor(position / 10) + 1,
        pageEnd: Math.floor(position / 10) + 1,
        content: `Conteúdo do chunk ${position}`,
        contentHash: `${position}`.padStart(64, "0"),
        tokenCount: 5,
        metadata: { source: "integration", position },
      }));

      await replaceMaterialChunks(material.id, chunks);

      expect(await prisma.materialChunk.count({ where: { materialId: material.id } })).toBe(500);
      const bounds = await prisma.materialChunk.findMany({
        where: { materialId: material.id },
        orderBy: { position: "asc" },
        select: { position: true, content: true },
      });
      expect(bounds[0]).toEqual({ position: 0, content: "Conteúdo do chunk 0" });
      expect(bounds.at(-1)).toEqual({ position: 499, content: "Conteúdo do chunk 499" });
    } finally {
      await prisma.material.delete({ where: { id: material.id } });
      await prisma.fileAsset.delete({ where: { id: file.id } });
    }
  });
});
