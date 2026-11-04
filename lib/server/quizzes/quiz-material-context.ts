import "server-only";
import { OpenAIEmbeddings } from "@langchain/openai";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { materialChunks, materials, questionSources, quizVersionMaterials } from "@/lib/server/db/schema";
import { getAiEnv } from "@/lib/server/env";
import { searchMaterialChunksBySimilarity, type MaterialChunkSemanticMatch } from "@/lib/server/materials/material-chunk-vector-store";

export async function retrieveQuizMaterialChunks(input: {
  userId: string;
  quizVersionId: string;
  query: string;
  perMaterialLimit: number;
}): Promise<MaterialChunkSemanticMatch[]> {
  const linkedMaterials = await db.select({
    id: materials.id,
    title: materials.title,
    ownerId: materials.ownerId,
    processingStatus: materials.processingStatus,
    processedAt: materials.processedAt,
    deletedAt: materials.deletedAt,
  })
    .from(quizVersionMaterials)
    .innerJoin(materials, eq(quizVersionMaterials.materialId, materials.id))
    .where(eq(quizVersionMaterials.quizVersionId, input.quizVersionId));
  if (!linkedMaterials.length) throw new Error("O quiz não possui materiais processados disponíveis.");
  for (const material of linkedMaterials) {
    if (material.ownerId !== input.userId || material.deletedAt || material.processingStatus !== "READY" || !material.processedAt) {
      throw new Error(`O material "${material.title}" não está disponível para este quiz.`);
    }
  }

  const env = getAiEnv();
  const embedding = await new OpenAIEmbeddings({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_EMBEDDING_MODEL,
  }).embedQuery(input.query);
  const result: MaterialChunkSemanticMatch[] = [];
  for (const material of linkedMaterials) {
    const chunks = await searchMaterialChunksBySimilarity({
      ownerId: input.userId,
      materialIds: [material.id],
      embedding,
      limit: input.perMaterialLimit,
    });
    if (!chunks.length) throw new Error(`O material "${material.title}" não possui trechos indexados. Reprocesse-o antes de continuar.`);
    result.push(...chunks);
  }
  return result;
}

export async function retrieveQuestionGradingEvidence(input: {
  userId: string;
  quizVersionId: string;
  questionId: string;
  query: string;
}): Promise<{ origin: "question_sources" | "semantic"; sources: Array<{ materialTitle: string; content: string; pageStart: number | null }> }> {
  const questionEvidence = await db.select({
    materialTitle: materials.title,
    content: materialChunks.content,
    pageStart: questionSources.pageStart,
  }).from(questionSources)
    .innerJoin(materialChunks, eq(questionSources.chunkId, materialChunks.id))
    .innerJoin(materials, eq(materialChunks.materialId, materials.id))
    .innerJoin(quizVersionMaterials, and(
      eq(quizVersionMaterials.materialId, materials.id),
      eq(quizVersionMaterials.quizVersionId, input.quizVersionId),
    ))
    .where(and(
      eq(questionSources.questionId, input.questionId),
      eq(materials.ownerId, input.userId),
      isNull(materials.deletedAt),
    ));
  if (questionEvidence.length) return { origin: "question_sources", sources: questionEvidence };

  const sources = await retrieveQuizMaterialChunks({
    userId: input.userId,
    quizVersionId: input.quizVersionId,
    query: input.query,
    perMaterialLimit: 2,
  });
  return { origin: "semantic", sources };
}
