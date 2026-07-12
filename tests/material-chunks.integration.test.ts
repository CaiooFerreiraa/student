import { beforeAll, describe, expect, mock, test } from "bun:test";
import { asc, eq, sql } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");
let replaceMaterialChunks: typeof import("@/lib/server/materials/material-chunk-repository").replaceMaterialChunks;
let setMaterialChunkEmbeddings: typeof import("@/lib/server/materials/material-chunk-vector-store").setMaterialChunkEmbeddings;

beforeAll(async () => {
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
  ({ replaceMaterialChunks } = await import("@/lib/server/materials/material-chunk-repository"));
  ({ setMaterialChunkEmbeddings } = await import("@/lib/server/materials/material-chunk-vector-store"));
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
    } finally {
      await db.delete(tables.materials).where(eq(tables.materials.id, material.id));
      await db.delete(tables.fileAssets).where(eq(tables.fileAssets.id, file.id));
    }
  });
});
