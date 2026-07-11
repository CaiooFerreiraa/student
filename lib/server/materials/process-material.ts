import "server-only";
import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ProcessingStatus } from "@/generated/prisma/enums";
import { getAiEnv, getBlobEnv, hasAiConfiguration } from "@/lib/server/env";
import { setMaterialChunkEmbeddings } from "@/lib/server/materials/material-chunk-vector-store";
import { prisma } from "@/lib/server/prisma";

type LoadedDocument = { pageContent: string; metadata: Record<string, unknown> };

async function loadDocuments(pathname: string, contentType: string): Promise<LoadedDocument[]> {
  const blobEnv = getBlobEnv();
  const result = await get(pathname, { access: "private", token: blobEnv.BLOB_READ_WRITE_TOKEN });
  if (!result || result.statusCode === 304 || !result.stream) throw new Error("Arquivo não encontrado no Blob.");
  const bytes = await new Response(result.stream).arrayBuffer();
  const file = new Blob([bytes], { type: contentType });

  if (contentType === "application/pdf") return new PDFLoader(file, { splitPages: true }).load();
  if (contentType.includes("wordprocessingml")) return new DocxLoader(file, { type: "docx" }).load();
  if (contentType.startsWith("text/")) return [{ pageContent: await file.text(), metadata: {} }];
  throw new Error("Este tipo de material não oferece extração textual automática.");
}

function pageNumber(metadata: Record<string, unknown>): number | null {
  const locator = metadata.loc;
  if (typeof locator === "object" && locator && "pageNumber" in locator && typeof locator.pageNumber === "number") {
    return locator.pageNumber;
  }
  return null;
}

export async function processMaterialJob(materialId: string): Promise<void> {
  const material = await prisma.material.findUnique({ where: { id: materialId }, include: { file: true } });
  if (!material || material.deletedAt) return;

  const job = await prisma.backgroundJob.findFirst({
    where: { targetType: "Material", targetId: materialId, kind: "PROCESS_MATERIAL" },
  });

  await prisma.$transaction([
    prisma.material.update({ where: { id: materialId }, data: { processingStatus: ProcessingStatus.PROCESSING, processingError: null } }),
    ...(job ? [prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "RUNNING", attempts: { increment: 1 }, lockedAt: new Date() } })] : []),
  ]);

  try {
    const loaded = await loadDocuments(material.file.pathname, material.file.contentType);
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

    await prisma.$transaction(async (tx) => {
      await tx.materialChunk.deleteMany({ where: { materialId } });
      for (const chunk of cleanChunks) {
        await tx.materialChunk.create({
          data: {
            materialId,
            position: chunk.position,
            pageStart: chunk.page,
            pageEnd: chunk.page,
            content: chunk.content,
            contentHash: chunk.hash,
            tokenCount: Math.ceil(chunk.content.length / 4),
            metadata: chunk.metadata,
          },
        });
      }
    });

    if (hasAiConfiguration() && cleanChunks.length > 0) {
      const aiEnv = getAiEnv();
      const embeddings = new OpenAIEmbeddings({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_EMBEDDING_MODEL });
      const vectors = await embeddings.embedDocuments(cleanChunks.map((chunk) => chunk.content));
      const stored = await prisma.materialChunk.findMany({ where: { materialId }, orderBy: { position: "asc" }, select: { id: true } });
      await setMaterialChunkEmbeddings(
        stored.flatMap((row, index) => {
          const embedding = vectors[index];
          return embedding ? [{ id: row.id, embedding }] : [];
        }),
      );
    }

    await prisma.$transaction([
      prisma.material.update({ where: { id: materialId }, data: { processingStatus: ProcessingStatus.READY, pageCount: loaded.length, processedAt: new Date() } }),
      ...(job ? [prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "SUCCEEDED", lockedAt: null, lockedBy: null } })] : []),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no processamento.";
    await prisma.$transaction([
      prisma.material.update({ where: { id: materialId }, data: { processingStatus: ProcessingStatus.FAILED, processingError: message } }),
      ...(job ? [prisma.backgroundJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: message, lockedAt: null } })] : []),
    ]);
    throw error;
  }
}
