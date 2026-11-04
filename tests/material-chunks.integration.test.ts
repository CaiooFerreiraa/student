import { beforeAll, describe, expect, mock, test } from "bun:test";
import { asc, eq, sql } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");
let replaceMaterialChunks: typeof import("@/lib/server/materials/material-chunk-repository").replaceMaterialChunks;
let setMaterialChunkEmbeddings: typeof import("@/lib/server/materials/material-chunk-vector-store").setMaterialChunkEmbeddings;
let searchMaterialChunksBySimilarity: typeof import("@/lib/server/materials/material-chunk-vector-store").searchMaterialChunksBySimilarity;

beforeAll(async () => {
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
  ({ replaceMaterialChunks } = await import("@/lib/server/materials/material-chunk-repository"));
  ({ setMaterialChunkEmbeddings, searchMaterialChunksBySimilarity } = await import("@/lib/server/materials/material-chunk-vector-store"));
});

describe("persistência em lote de chunks", () => {
  test("substitui centenas de chunks atomicamente no Neon", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const [file] = await db.insert(tables.fileAssets).values({
        ownerId: user.id,
        purpose: "MATERIAL",
        status: "AVAILABLE",
        pathname: `users/${user.id}/materials/chunks-${nonce}.txt`,
        url: `https://example.com/chunks-${nonce}.txt`,
        originalName: "chunks.txt",
        contentType: "text/plain",
        byteSize: 1_024,
      }).returning();
    if (!file) throw new Error("Fixture de arquivo não criada.");
    const [material] = await db.insert(tables.materials).values({
        ownerId: user.id,
        fileId: file.id,
        title: "Teste de chunks",
        type: "TEXT",
        processingStatus: "PROCESSING", updatedAt: new Date(),
      }).returning();
    if (!material) throw new Error("Fixture de material não criada.");
    let secondFileId: string | null = null;
    let secondMaterialId: string | null = null;

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

      const [count] = await db.select({ value: sql<number>`count(*)::int` }).from(tables.materialChunks).where(eq(tables.materialChunks.materialId, material.id));
      expect(count?.value).toBe(500);
      const bounds = await db.select({ position: tables.materialChunks.position, content: tables.materialChunks.content }).from(tables.materialChunks).where(eq(tables.materialChunks.materialId, material.id)).orderBy(asc(tables.materialChunks.position));
      expect(bounds[0]).toEqual({ position: 0, content: "Conteúdo do chunk 0" });
      expect(bounds.at(-1)).toEqual({ position: 499, content: "Conteúdo do chunk 499" });

      const stored = await db.select({ id: tables.materialChunks.id }).from(tables.materialChunks).where(eq(tables.materialChunks.materialId, material.id)).orderBy(asc(tables.materialChunks.position)).limit(205);
      await setMaterialChunkEmbeddings(stored.map((chunk, index) => ({
        id: chunk.id,
        embedding: Array.from({ length: 1_536 }, (_, dimension) => dimension === index % 1_536 ? 1 : 0),
      })));
      const [embeddedCount] = await db.select({ value: sql<number>`count(${tables.materialChunks.embedding})::int` }).from(tables.materialChunks).where(eq(tables.materialChunks.materialId, material.id));
      expect(embeddedCount?.value).toBe(205);

      await db.update(tables.materials).set({ processingStatus: "READY", processedAt: new Date() }).where(eq(tables.materials.id, material.id));
      const [secondFile] = await db.insert(tables.fileAssets).values({ ownerId: user.id, purpose: "MATERIAL", status: "AVAILABLE", pathname: `users/${user.id}/materials/other-${nonce}.txt`, url: `https://example.com/other-${nonce}.txt`, originalName: "other.txt", contentType: "text/plain", byteSize: 50 }).returning();
      if (!secondFile) throw new Error("Segundo arquivo não criado.");
      secondFileId = secondFile.id;
      const [secondMaterial] = await db.insert(tables.materials).values({ ownerId: user.id, fileId: secondFile.id, title: "Outro material", type: "TEXT", processingStatus: "READY", processedAt: new Date(), updatedAt: new Date() }).returning();
      if (!secondMaterial) throw new Error("Segundo material não criado.");
      secondMaterialId = secondMaterial.id;
      await replaceMaterialChunks(secondMaterial.id, [{ position: 0, pageStart: 1, pageEnd: 1, content: "Trecho de outro material", contentHash: "f".repeat(64), tokenCount: 5, metadata: {} }]);
      const [secondChunk] = await db.select({ id: tables.materialChunks.id }).from(tables.materialChunks).where(eq(tables.materialChunks.materialId, secondMaterial.id));
      if (!secondChunk) throw new Error("Segundo trecho não criado.");
      const vector = Array.from({ length: 1_536 }, (_, dimension) => dimension === 0 ? 1 : 0);
      await setMaterialChunkEmbeddings([{ id: secondChunk.id, embedding: vector }]);

      const matches = await searchMaterialChunksBySimilarity({ ownerId: user.id, embedding: vector, materialIds: [material.id], limit: 10 });
      expect(matches).toHaveLength(10);
      expect(matches.every((match) => match.materialId === material.id)).toBe(true);
      expect(matches[0]?.id).toBeTruthy();
      expect(await searchMaterialChunksBySimilarity({ ownerId: user.id, embedding: vector, materialIds: [], limit: 10 })).toEqual([]);
    } finally {
      if (secondMaterialId) await db.delete(tables.materials).where(eq(tables.materials.id, secondMaterialId));
      if (secondFileId) await db.delete(tables.fileAssets).where(eq(tables.fileAssets.id, secondFileId));
      await db.delete(tables.materials).where(eq(tables.materials.id, material.id));
      await db.delete(tables.fileAssets).where(eq(tables.fileAssets.id, file.id));
    }
  });
});
