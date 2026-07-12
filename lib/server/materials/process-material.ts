import "server-only";
import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { asc, eq } from "drizzle-orm";
import { ProcessingStatus } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { backgroundJobs, fileAssets, materialChunks, materials } from "@/lib/server/db/schema";
import { getAiEnv, getBlobEnv, hasAiConfiguration } from "@/lib/server/env";
import { loadDocumentsFromFile, type LoadedDocument } from "@/lib/server/materials/document-loader";
import { replaceMaterialChunks } from "@/lib/server/materials/material-chunk-repository";
import { setMaterialChunkEmbeddings } from "@/lib/server/materials/material-chunk-vector-store";
import { claimMaterialJob } from "@/lib/server/materials/material-job-repository";

async function loadDocuments(pathname: string, contentType: string): Promise<LoadedDocument[]> {
  const blobEnv = getBlobEnv();
  const result = await get(pathname, { access: "private", token: blobEnv.BLOB_READ_WRITE_TOKEN });
  if (!result || result.statusCode === 304 || !result.stream) throw new Error("Arquivo não encontrado no Blob.");
  const bytes = await new Response(result.stream).arrayBuffer();
  const file = new Blob([bytes], { type: contentType });

  return loadDocumentsFromFile(file, contentType);
}

function pageNumber(metadata: Record<string, unknown>): number | null {
  const locator = metadata.loc;
  if (typeof locator === "object" && locator && "pageNumber" in locator && typeof locator.pageNumber === "number") {
    return locator.pageNumber;
  }
  return null;
}

export async function processMaterialJob(materialId: string): Promise<void> {
  const [row] = await db.select({ material: materials, file: fileAssets }).from(materials)
    .innerJoin(fileAssets, eq(materials.fileId, fileAssets.id)).where(eq(materials.id, materialId)).limit(1);
  if (!row || row.material.deletedAt) return;
  const { file } = row;

  const startedAt = new Date();
  const jobId = await claimMaterialJob(materialId, startedAt);
  if (!jobId) return;

  await db.update(materials).set({ processingStatus: ProcessingStatus.PROCESSING, processingError: null, updatedAt: startedAt }).where(eq(materials.id, materialId));

  try {
    const loaded = await loadDocuments(file.pathname, file.contentType);
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1_000, chunkOverlap: 150 });
    const chunks = await splitter.splitDocuments(loaded);
    const cleanChunks = chunks
      .map((chunk, position) => ({
        position,
        content: chunk.pageContent.trim(),
        page: pageNumber(chunk.metadata),
        hash: createHash("sha256").update(chunk.pageContent.trim()).digest("hex"),
        metadata: chunk.metadata,
      }))
      .filter((chunk) => chunk.content.length > 0);

    await replaceMaterialChunks(
      materialId,
      cleanChunks.map((chunk) => ({
        position: chunk.position,
        pageStart: chunk.page,
        pageEnd: chunk.page,
        content: chunk.content,
        contentHash: chunk.hash,
        tokenCount: Math.ceil(chunk.content.length / 4),
        metadata: chunk.metadata,
      })),
    );

    if (hasAiConfiguration() && cleanChunks.length > 0) {
      const aiEnv = getAiEnv();
      const embeddings = new OpenAIEmbeddings({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_EMBEDDING_MODEL });
      const vectors = await embeddings.embedDocuments(cleanChunks.map((chunk) => chunk.content));
      const stored = await db.select({ id: materialChunks.id }).from(materialChunks).where(eq(materialChunks.materialId, materialId)).orderBy(asc(materialChunks.position));
      await setMaterialChunkEmbeddings(
        stored.flatMap((row, index) => {
          const embedding = vectors[index];
          return embedding ? [{ id: row.id, embedding }] : [];
        }),
      );
    }

    const completedAt = new Date();
    await db.transaction(async (transaction) => {
      await transaction.update(materials).set({ processingStatus: ProcessingStatus.READY, pageCount: loaded.length, processedAt: completedAt, updatedAt: completedAt }).where(eq(materials.id, materialId));
      await transaction.update(backgroundJobs).set({ status: "SUCCEEDED", lockedAt: null, lockedBy: null, updatedAt: completedAt }).where(eq(backgroundJobs.id, jobId));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no processamento.";
    const failedAt = new Date();
    await db.transaction(async (transaction) => {
      await transaction.update(materials).set({ processingStatus: ProcessingStatus.FAILED, processingError: message, updatedAt: failedAt }).where(eq(materials.id, materialId));
      await transaction.update(backgroundJobs).set({ status: "FAILED", lastError: message, lockedAt: null, updatedAt: failedAt }).where(eq(backgroundJobs.id, jobId));
    });
    throw error;
  }
}
