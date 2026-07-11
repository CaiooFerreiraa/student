import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { AiFeature, EssayEvaluationStatus, EssaySubmissionStatus, RunStatus } from "@/generated/prisma/enums";
import { getAiEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

const evaluationSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  improvementPlan: z.array(z.string()),
  criteria: z.array(z.object({
    code: z.string(),
    score: z.number().int().nonnegative(),
    feedback: z.string(),
    evidence: z.array(z.string()),
    suggestions: z.array(z.string()),
  })),
});

export const ESSAY_GRADING_PROMPT_VERSION = "essay-grading-v1";

export async function gradeEssaySubmission(userId: string, submissionId: string): Promise<void> {
  const submission = await prisma.essaySubmission.findFirst({
    where: { id: submissionId, userId },
    include: { assignment: { include: { rubric: { include: { criteria: { orderBy: { position: "asc" } } } } } }, evaluations: true },
  });
  if (!submission?.confirmedText) throw new Error("A transcrição deve ser confirmada antes da correção.");
  const aiEnv = getAiEnv();
  const run = await prisma.aiRun.create({ data: { userId, feature: AiFeature.ESSAY_GRADING, targetType: "EssaySubmission", targetId: submissionId, status: RunStatus.RUNNING, model: aiEnv.OPENAI_CHAT_MODEL, promptVersion: ESSAY_GRADING_PROMPT_VERSION } });
  await prisma.essaySubmission.update({ where: { id: submissionId }, data: { status: EssaySubmissionStatus.GRADING } });

  try {
    const criteriaText = submission.assignment.rubric.criteria.map((criterion) => `${criterion.code} (${criterion.maximumScore} pontos): ${criterion.description}`).join("\n");
    const model = new ChatOpenAI({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_CHAT_MODEL });
    const structured = model.withStructuredOutput(evaluationSchema, { name: "essay_evaluation" });
    const result = await structured.invoke(`Você é um avaliador pedagógico de redações. Avalie estritamente pela rubrica, justifique cada nota com evidências literais e não invente trechos. A nota é uma estimativa, não oficial.\n\nPROPOSTA:\n${submission.assignment.prompt}\n\nRUBRICA:\n${criteriaText}\n\nREDAÇÃO:\n${submission.confirmedText}`);
    const criteriaByCode = new Map(submission.assignment.rubric.criteria.map((criterion) => [criterion.code, criterion]));
    const scores = result.criteria.map((score) => {
      const criterion = criteriaByCode.get(score.code);
      if (!criterion) throw new Error(`Critério desconhecido: ${score.code}`);
      return { ...score, criterion, score: Math.min(score.score, criterion.maximumScore) };
    });
    const totalScore = scores.reduce((total, score) => total + score.score, 0);

    await prisma.$transaction(async (tx) => {
      const evaluation = await tx.essayEvaluation.create({
        data: {
          submissionId,
          rubricId: submission.assignment.rubricId,
          evaluatorIndex: submission.evaluations.length + 1,
          status: EssayEvaluationStatus.COMPLETED,
          totalScore,
          summary: result.summary,
          strengths: result.strengths,
          improvementPlan: result.improvementPlan,
          model: aiEnv.OPENAI_CHAT_MODEL,
          promptVersion: ESSAY_GRADING_PROMPT_VERSION,
          completedAt: new Date(),
          scores: { create: scores.map((score) => ({ criterionId: score.criterion.id, score: score.score, feedback: score.feedback, evidence: score.evidence, suggestions: score.suggestions })) },
        },
      });
      await tx.essaySubmission.update({ where: { id: submissionId }, data: { status: EssaySubmissionStatus.GRADED, finalEvaluationId: evaluation.id, gradedAt: new Date() } });
      await tx.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.SUCCEEDED, completedAt: new Date() } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na correção.";
    await prisma.$transaction([
      prisma.essaySubmission.update({ where: { id: submissionId }, data: { status: EssaySubmissionStatus.FAILED } }),
      prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.FAILED, errorMessage: message, completedAt: new Date() } }),
    ]);
    throw error;
  }
}
