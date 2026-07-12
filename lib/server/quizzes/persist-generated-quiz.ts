import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { RunStatus } from "@/domain/enums";
import type { GeneratedQuestion } from "@/domain/quiz/generated-quiz";
import { db } from "@/lib/server/db";
import { aiRuns, questionOptions, questions as questionTable, questionSources, quizzes, quizVersions } from "@/lib/server/db/schema";

export type QuestionSourceReference = { id: string; pageStart: number | null; pageEnd: number | null; content: string };

export async function persistGeneratedQuiz(input: { quizId: string; versionId: string; aiRunId: string; questions: GeneratedQuestion[]; sources: Map<string, QuestionSourceReference> }): Promise<void> {
  const mapped = input.questions.map((value, index) => ({ id: randomUUID(), value, position: index + 1 }));
  const questionRows = mapped.map(({ id, value, position }) => ({ id, quizVersionId: input.versionId, position, type: value.type, statement: value.statement, explanation: value.explanation, difficulty: value.difficulty, points: value.points, correctBoolean: value.correctBoolean, modelAnswer: value.modelAnswer, gradingRubric: value.gradingRubric }));
  const optionRows = mapped.flatMap(({ id, value }) => (value.options ?? []).map((option, index) => ({ questionId: id, position: index + 1, content: option.content, isCorrect: option.isCorrect, explanation: option.explanation })));
  const sourceRows = mapped.flatMap(({ id, value }) => [...new Set(value.sourceKeys)].map((sourceKey) => {
    const source = input.sources.get(sourceKey);
    if (!source) throw new Error(`Fonte inválida retornada pelo modelo: ${sourceKey}`);
    return { questionId: id, chunkId: source.id, pageStart: source.pageStart, pageEnd: source.pageEnd, excerpt: source.content.slice(0, 500) };
  }));
  const totalPoints = input.questions.reduce((sum, question) => sum + question.points, 0);
  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.delete(questionTable).where(eq(questionTable.quizVersionId, input.versionId));
    if (questionRows.length) await transaction.insert(questionTable).values(questionRows);
    if (optionRows.length) await transaction.insert(questionOptions).values(optionRows);
    if (sourceRows.length) await transaction.insert(questionSources).values(sourceRows);
    await transaction.update(quizVersions).set({ status: "READY", totalPoints }).where(eq(quizVersions.id, input.versionId));
    await transaction.update(quizzes).set({ status: "READY", currentVersionId: input.versionId, updatedAt: now }).where(eq(quizzes.id, input.quizId));
    await transaction.update(aiRuns).set({ status: RunStatus.SUCCEEDED, completedAt: now }).where(eq(aiRuns.id, input.aiRunId));
  });
}
