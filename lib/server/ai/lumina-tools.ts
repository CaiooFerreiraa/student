import "server-only";
import { tool } from "@langchain/core/tools";
import { OpenAIEmbeddings } from "@langchain/openai";
import { z } from "zod";
import { DifficultyLevel, EducationLevel, GenerationMode, QuizMode } from "@/generated/prisma/enums";
import { getAiEnv } from "@/lib/server/env";
import { searchMaterialChunksBySimilarity } from "@/lib/server/materials/material-chunk-vector-store";
import { prisma } from "@/lib/server/prisma";

export function createLuminaTools(userId: string) {
  const listMaterials = tool(
    async ({ limit }) => {
      const materials = await prisma.material.findMany({
        where: { ownerId: userId, deletedAt: null, processingStatus: "READY" },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, title: true, type: true, pageCount: true, subject: { select: { name: true } } },
      });
      return JSON.stringify(materials);
    },
    {
      name: "list_materials",
      description: "Lista materiais prontos pertencentes ao usuário atual.",
      schema: z.object({ limit: z.number().int().min(1).max(20).default(10) }),
    },
  );

  const searchMaterials = tool(
    async ({ query, limit }) => {
      const aiEnv = getAiEnv();
      const embeddings = new OpenAIEmbeddings({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_EMBEDDING_MODEL });
      const vector = await embeddings.embedQuery(query);
      const rows = await searchMaterialChunksBySimilarity({ ownerId: userId, embedding: vector, limit });
      return JSON.stringify(rows);
    },
    {
      name: "search_materials",
      description: "Busca semanticamente trechos nos materiais do usuário e retorna conteúdo, documento e páginas.",
      schema: z.object({ query: z.string().min(3).max(500), limit: z.number().int().min(1).max(8).default(5) }),
    },
  );

  const createQuizDraft = tool(
    async (input) => {
      const subject = input.subject
        ? await prisma.subject.findFirst({ where: { name: { equals: input.subject, mode: "insensitive" }, OR: [{ ownerId: userId }, { ownerId: null }] } })
        : null;
      const quiz = await prisma.quiz.create({
        data: {
          ownerId: userId,
          subjectId: subject?.id,
          title: input.title,
          description: input.description,
          status: "DRAFT",
          versions: {
            create: {
              versionNumber: 1,
              status: "DRAFT",
              educationLevel: input.educationLevel as EducationLevel,
              difficulty: input.difficulty as DifficultyLevel,
              mode: input.mode as QuizMode,
              generationMode: GenerationMode.AI,
              requestedQuestionCount: input.questionCount,
            },
          },
        },
        include: { versions: { select: { id: true, versionNumber: true } } },
      });
      return JSON.stringify({ quizId: quiz.id, title: quiz.title, version: quiz.versions[0]?.versionNumber, status: quiz.status });
    },
    {
      name: "create_quiz_draft",
      description: "Cria um rascunho persistente de quiz após pedido explícito do usuário. Não gera nem publica questões.",
      schema: z.object({
        title: z.string().min(3).max(160),
        description: z.string().max(1000).optional(),
        subject: z.string().max(100).optional(),
        educationLevel: z.enum(EducationLevel).default(EducationLevel.UNDERGRADUATE),
        difficulty: z.enum(DifficultyLevel).default(DifficultyLevel.MEDIUM),
        mode: z.enum(QuizMode).default(QuizMode.STUDY),
        questionCount: z.number().int().min(5).max(50).default(10),
      }),
    },
  );

  return [listMaterials, searchMaterials, createQuizDraft];
}
