import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { createQuizSchema, type CreateQuizInput } from "@/domain/quiz/quiz-config";
import { db } from "@/lib/server/db";
import { materials, quizzes, quizVersionMaterials, quizVersions, subjects } from "@/lib/server/db/schema";

export async function createQuiz(userId: string, raw: CreateQuizInput) {
  const input = createQuizSchema.parse(raw);
  if (input.subjectId) {
    const [subject] = await db.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, input.subjectId), or(eq(subjects.ownerId, userId), isNull(subjects.ownerId)))).limit(1);
    if (!subject) throw new Error("Disciplina inválida.");
  }
  if (input.materialIds.length) {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(materials).where(and(inArray(materials.id, input.materialIds), eq(materials.ownerId, userId), isNull(materials.deletedAt), eq(materials.processingStatus, "READY")));
    if (result?.count !== input.materialIds.length) throw new Error("Um ou mais materiais não estão prontos ou não pertencem ao usuário.");
  }
  const total = input.questionDistribution.multipleChoice + input.questionDistribution.trueFalse + input.questionDistribution.open;
  return db.transaction(async (transaction) => {
    const [quiz] = await transaction.insert(quizzes).values({ ownerId: userId, subjectId: input.subjectId, title: input.title, description: input.description, status: "DRAFT", updatedAt: new Date() }).returning();
    if (!quiz) throw new Error("Não foi possível criar o quiz.");
    const [version] = await transaction.insert(quizVersions).values({ quizId: quiz.id, versionNumber: 1, educationLevel: input.educationLevel, difficulty: input.difficulty, mode: input.mode, generationMode: input.generationMode, answerRevealMode: input.answerRevealMode, requestedQuestionCount: total, questionDistribution: input.questionDistribution, timeLimitSeconds: input.timeLimitSeconds, timePerQuestionSeconds: input.timePerQuestionSeconds }).returning();
    if (!version) throw new Error("Não foi possível criar a versão do quiz.");
    const versionMaterials = input.materialIds.map((materialId) => ({ quizVersionId: version.id, materialId }));
    if (versionMaterials.length) await transaction.insert(quizVersionMaterials).values(versionMaterials);
    return { ...quiz, versions: [{ ...version, materials: versionMaterials }] };
  });
}
