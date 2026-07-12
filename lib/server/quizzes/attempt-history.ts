import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { attemptAnswers, materialChunks, materials, questionOptions, questions, questionSources, quizzes, quizAttempts, quizVersions, subjects } from "@/lib/server/db/schema";

export async function listAttemptHistory(userId: string, quizId?: string) {
  const rows = await db.query.quizAttempts.findMany({
    where: and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, "SUBMITTED"), ...(quizId ? [eq(quizAttempts.quizId, quizId)] : [])),
    orderBy: [desc(quizAttempts.submittedAt)],
    with: { quiz: { with: { subject: true } }, quizVersion: true },
  });
  return rows;
}

export async function getAttemptReview(userId: string, attemptId: string) {
  const [row] = await db.select({ attempt: quizAttempts, quiz: quizzes, subject: subjects, quizVersion: quizVersions })
    .from(quizAttempts).innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id)).leftJoin(subjects, eq(quizzes.subjectId, subjects.id))
    .innerJoin(quizVersions, eq(quizAttempts.quizVersionId, quizVersions.id))
    .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId), eq(quizAttempts.status, "SUBMITTED"))).limit(1);
  if (!row) return null;
  const questionRows = await db.select().from(questions).where(eq(questions.quizVersionId, row.quizVersion.id)).orderBy(asc(questions.position));
  const questionIds = questionRows.map((question) => question.id);
  const [optionRows, sourceRows, answerRows] = questionIds.length ? await Promise.all([
    db.select().from(questionOptions).where(inArray(questionOptions.questionId, questionIds)).orderBy(asc(questionOptions.position)),
    db.select({ source: questionSources, chunk: materialChunks, material: materials }).from(questionSources).innerJoin(materialChunks, eq(questionSources.chunkId, materialChunks.id)).innerJoin(materials, eq(materialChunks.materialId, materials.id)).where(inArray(questionSources.questionId, questionIds)),
    db.select({ answer: attemptAnswers, selectedOption: questionOptions }).from(attemptAnswers).leftJoin(questionOptions, eq(attemptAnswers.selectedOptionId, questionOptions.id)).where(eq(attemptAnswers.attemptId, attemptId)),
  ]) : [[], [], []];
  const answers = new Map(answerRows.map(({ answer, selectedOption }) => [answer.questionId, { ...answer, selectedOption }]));
  return {
    ...row.attempt,
    quiz: { ...row.quiz, subject: row.subject },
    quizVersion: row.quizVersion,
    questions: questionRows.map((question) => ({
      ...question,
      options: optionRows.filter((option) => option.questionId === question.id),
      sources: sourceRows.filter(({ source }) => source.questionId === question.id).map(({ source, chunk, material }) => ({ ...source, chunk: { ...chunk, material } })),
      answer: answers.get(question.id) ?? null,
    })),
  };
}
