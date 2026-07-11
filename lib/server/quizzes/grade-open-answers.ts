import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { AiFeature, RunStatus } from "@/generated/prisma/enums";
import { getAiEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

const schema = z.object({ pointsAwarded: z.number().nonnegative(), feedback: z.string().min(5) });
export const OPEN_ANSWER_PROMPT_VERSION = "open-answer-grading-v1";

export async function gradeOpenAnswers(userId: string, attemptId: string): Promise<void> {
  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, userId }, include: { answers: { where: { gradingStatus: "PENDING" }, include: { question: true } } } });
  if (!attempt || !attempt.answers.length) return;
  const env = getAiEnv();
  const run = await prisma.aiRun.create({ data: { userId, feature: AiFeature.OPEN_ANSWER_GRADING, targetType: "QuizAttempt", targetId: attemptId, status: RunStatus.RUNNING, model: env.OPENAI_CHAT_MODEL, promptVersion: OPEN_ANSWER_PROMPT_VERSION } });
  try {
    const model = new ChatOpenAI({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_CHAT_MODEL });
    const grader = model.withStructuredOutput(schema, { name: "open_answer_grade" });
    for (const answer of attempt.answers) {
      const result = await grader.invoke(`Avalie a resposta usando estritamente a rubrica. Não exija palavras idênticas à resposta-modelo.\n\nQuestão: ${answer.question.statement}\nResposta-modelo: ${answer.question.modelAnswer ?? ""}\nRubrica: ${JSON.stringify(answer.question.gradingRubric ?? {})}\nMáximo: ${answer.question.points}\nResposta do estudante: ${answer.textAnswer ?? ""}`);
      const points = Math.min(answer.question.points, result.pointsAwarded);
      await prisma.attemptAnswer.update({ where: { id: answer.id }, data: { gradingStatus: "GRADED", gradedBy: "AI", gradingModel: env.OPENAI_CHAT_MODEL, gradingPromptVersion: OPEN_ANSWER_PROMPT_VERSION, pointsAwarded: points, feedback: result.feedback, gradedAt: new Date() } });
    }
    const answers = await prisma.attemptAnswer.findMany({ where: { attemptId }, select: { pointsAwarded: true } });
    const score = answers.reduce((sum, answer) => sum + Number(answer.pointsAwarded ?? 0), 0);
    const maximumScore = Number(attempt.maximumScore ?? 0);
    await prisma.$transaction([
      prisma.quizAttempt.update({ where: { id: attemptId }, data: { score, percentage: maximumScore ? score / maximumScore * 100 : 0 } }),
      prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.SUCCEEDED, completedAt: new Date() } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao corrigir respostas abertas.";
    await prisma.$transaction([
      prisma.attemptAnswer.updateMany({ where: { attemptId, gradingStatus: "PENDING" }, data: { gradingStatus: "FAILED" } }),
      prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.FAILED, errorMessage: message, completedAt: new Date() } }),
    ]);
  }
}
