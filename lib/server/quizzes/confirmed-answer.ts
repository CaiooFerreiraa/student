import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { attemptAnswers, materialChunks, materials, questionOptions, questions, questionSources, quizVersions } from "@/lib/server/db/schema";
import type { ConfirmedAnswer } from "@/domain/quiz/session-feedback";

type Answer = typeof attemptAnswers.$inferSelect;
type RevealMode = typeof quizVersions.$inferSelect["answerRevealMode"];

export async function getConfirmedAnswers(answers: Answer[], revealMode: RevealMode): Promise<ConfirmedAnswer[]> {
  if (answers.length === 0) return [];
  const reveal = revealMode === "AFTER_QUESTION";
  const questionIds = answers.map((answer) => answer.questionId);
  const questionRows = reveal ? await db.select().from(questions).where(inArray(questions.id, questionIds)) : [];
  const objectiveIds = questionRows.filter((question) => question.type !== "OPEN").map((question) => question.id);
  const [optionRows, sourceRows] = objectiveIds.length ? await Promise.all([
    db.select({ questionId: questionOptions.questionId, id: questionOptions.id, isCorrect: questionOptions.isCorrect, explanation: questionOptions.explanation })
      .from(questionOptions).where(inArray(questionOptions.questionId, objectiveIds)),
    db.select({ questionId: questionSources.questionId, title: materials.title, pageStart: questionSources.pageStart })
      .from(questionSources).innerJoin(materialChunks, eq(questionSources.chunkId, materialChunks.id))
      .innerJoin(materials, eq(materialChunks.materialId, materials.id))
      .where(inArray(questionSources.questionId, objectiveIds)),
  ]) : [[], []];
  const questionById = new Map(questionRows.map((question) => [question.id, question]));

  return answers.map((answer) => {
    const question = questionById.get(answer.questionId);
    const shouldReveal = reveal && question && question.type !== "OPEN";
    const options = shouldReveal ? optionRows.filter((option) => option.questionId === answer.questionId) : [];
    const correctOption = options.find((option) => option.isCorrect);
    return {
      questionId: answer.questionId,
      selectedOptionId: answer.selectedOptionId,
      booleanAnswer: answer.booleanAnswer,
      textAnswer: answer.textAnswer,
      isCorrect: shouldReveal ? answer.isCorrect : null,
      gradingStatus: answer.gradingStatus,
      resolution: shouldReveal ? {
        explanation: question.explanation,
        correctOptionId: correctOption?.id ?? null,
        correctBoolean: question.correctBoolean,
        options: options.map(({ id, explanation }) => ({ id, explanation })),
        sources: sourceRows.filter((source) => source.questionId === answer.questionId)
          .map(({ title, pageStart }) => ({ title, pageStart })),
      } : null,
    };
  });
}
