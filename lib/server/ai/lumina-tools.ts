import "server-only";
import { tool } from "@langchain/core/tools";
import { OpenAIEmbeddings, tools as openAiTools } from "@langchain/openai";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { DifficultyLevel, EducationLevel, GenerationMode, QuizMode } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { materials, quizzes, quizVersions, subjects } from "@/lib/server/db/schema";
import { getAiEnv } from "@/lib/server/env";
import { searchMaterialChunksBySimilarity } from "@/lib/server/materials/material-chunk-vector-store";

export function createLuminaTools(userId: string) {
  const listMaterials = tool(
    async ({ limit }) => {
      const rows = await db.select({ id: materials.id, title: materials.title, type: materials.type, pageCount: materials.pageCount, subjectName: subjects.name })
        .from(materials).leftJoin(subjects, eq(materials.subjectId, subjects.id))
        .where(and(eq(materials.ownerId, userId), isNull(materials.deletedAt), eq(materials.processingStatus, "READY")))
        .orderBy(desc(materials.updatedAt)).limit(limit);
      return JSON.stringify(rows.map((row) => ({ ...row, subject: row.subjectName ? { name: row.subjectName } : null, subjectName: undefined })));
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
      const [subject] = input.subject ? await db.select().from(subjects).where(and(ilike(subjects.name, input.subject), or(eq(subjects.ownerId, userId), isNull(subjects.ownerId)))).limit(1) : [];
      const result = await db.transaction(async (transaction) => {
        const [quiz] = await transaction.insert(quizzes).values({ ownerId: userId, subjectId: subject?.id, title: input.title, description: input.description, status: "DRAFT", updatedAt: new Date() }).returning();
        if (!quiz) throw new Error("Não foi possível criar o quiz.");
        const [version] = await transaction.insert(quizVersions).values({ quizId: quiz.id, versionNumber: 1, status: "DRAFT", educationLevel: input.educationLevel as EducationLevel, difficulty: input.difficulty as DifficultyLevel, mode: input.mode as QuizMode, generationMode: GenerationMode.AI, requestedQuestionCount: input.questionCount }).returning({ versionNumber: quizVersions.versionNumber });
        return { quiz, version };
      });
      return JSON.stringify({ quizId: result.quiz.id, title: result.quiz.title, version: result.version?.versionNumber, status: result.quiz.status });
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

  const webSearch = openAiTools.webSearch({
    search_context_size: "medium",
    userLocation: {
      type: "approximate",
      country: "BR",
      region: "Bahia",
      timezone: "America/Bahia",
    },
  });

  return [listMaterials, searchMaterials, createQuizDraft, webSearch];
}
