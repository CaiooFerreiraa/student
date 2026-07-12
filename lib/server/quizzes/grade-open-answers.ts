import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { AiFeature, RunStatus } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { aiRuns, attemptAnswers, questions, quizAttempts } from "@/lib/server/db/schema";
import { getAiEnv } from "@/lib/server/env";

const schema = z.object({ pointsAwarded: z.number().nonnegative(), feedback: z.string().min(5) });
export const OPEN_ANSWER_PROMPT_VERSION = "open-answer-grading-v1";

export async function gradeOpenAnswers(userId: string, attemptId: string): Promise<void> {
  const [attempt] = await db.select().from(quizAttempts).where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId))).limit(1);
  if (!attempt) return;
  const pendingAnswers = await db.select({ answer: attemptAnswers, question: questions }).from(attemptAnswers).innerJoin(questions, eq(attemptAnswers.questionId, questions.id))
    .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.gradingStatus, "PENDING")));
  if (!pendingAnswers.length) return;
  const env = getAiEnv();
  const [run] = await db.insert(aiRuns).values({ userId, feature: AiFeature.OPEN_ANSWER_GRADING, targetType: "QuizAttempt", targetId: attemptId, status: RunStatus.RUNNING, model: env.OPENAI_CHAT_MODEL, promptVersion: OPEN_ANSWER_PROMPT_VERSION }).returning();
  if (!run) return;
  try {
    const grader = new ChatOpenAI({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_CHAT_MODEL }).withStructuredOutput(schema, { name: "open_answer_grade" });
    for (const { answer, question } of pendingAnswers) {
      const result = await grader.invoke(`Avalie a resposta usando estritamente a rubrica. Não exija palavras idênticas à resposta-modelo.\n\nQuestão: ${question.statement}\nResposta-modelo: ${question.modelAnswer ?? ""}\nRubrica: ${JSON.stringify(question.gradingRubric ?? {})}\nMáximo: ${question.points}\nResposta do estudante: ${answer.textAnswer ?? ""}`);
      const points = Math.min(question.points, result.pointsAwarded);
      await db.update(attemptAnswers).set({ gradingStatus: "GRADED", gradedBy: "AI", gradingModel: env.OPENAI_CHAT_MODEL, gradingPromptVersion: OPEN_ANSWER_PROMPT_VERSION, pointsAwarded: points.toFixed(2), feedback: result.feedback, gradedAt: new Date() }).where(eq(attemptAnswers.id, answer.id));
    }
    const answers = await db.select({ pointsAwarded: attemptAnswers.pointsAwarded }).from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId));
    const score = answers.reduce((sum, answer) => sum + Number(answer.pointsAwarded ?? 0), 0);
    const maximumScore = Number(attempt.maximumScore ?? 0);
    await db.transaction(async (transaction) => {
      await transaction.update(quizAttempts).set({ score: score.toFixed(2), percentage: (maximumScore ? score / maximumScore * 100 : 0).toFixed(2) }).where(eq(quizAttempts.id, attemptId));
      await transaction.update(aiRuns).set({ status: RunStatus.SUCCEEDED, completedAt: new Date() }).where(eq(aiRuns.id, run.id));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao corrigir respostas abertas.";
    await db.transaction(async (transaction) => {
      await transaction.update(attemptAnswers).set({ gradingStatus: "FAILED" }).where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.gradingStatus, "PENDING")));
      await transaction.update(aiRuns).set({ status: RunStatus.FAILED, errorMessage: message, completedAt: new Date() }).where(eq(aiRuns.id, run.id));
    });
  }
}
