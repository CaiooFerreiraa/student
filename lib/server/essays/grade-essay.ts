import "server-only";
import { ChatOpenAI } from "@langchain/openai";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { AiFeature, EssayEvaluationStatus, EssaySubmissionStatus, RunStatus } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { aiRuns, essayAssignments, essayCriterionScores, essayEvaluations, essayRubricCriteria, essayRubrics, essaySubmissions } from "@/lib/server/db/schema";
import { getAiEnv } from "@/lib/server/env";

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
  const [row] = await db.select({ submission: essaySubmissions, assignment: essayAssignments, rubric: essayRubrics }).from(essaySubmissions)
    .innerJoin(essayAssignments, eq(essaySubmissions.assignmentId, essayAssignments.id)).innerJoin(essayRubrics, eq(essayAssignments.rubricId, essayRubrics.id))
    .where(and(eq(essaySubmissions.id, submissionId), eq(essaySubmissions.userId, userId))).limit(1);
  if (!row?.submission.confirmedText) throw new Error("A transcrição deve ser confirmada antes da correção.");
  const { submission, assignment, rubric } = row;
  const criteria = await db.select().from(essayRubricCriteria).where(eq(essayRubricCriteria.rubricId, rubric.id)).orderBy(asc(essayRubricCriteria.position));
  const [evaluationCount] = await db.select({ value: sql<number>`count(*)::int` }).from(essayEvaluations).where(eq(essayEvaluations.submissionId, submissionId));
  const aiEnv = getAiEnv();
  const [run] = await db.insert(aiRuns).values({ userId, feature: AiFeature.ESSAY_GRADING, targetType: "EssaySubmission", targetId: submissionId, status: RunStatus.RUNNING, model: aiEnv.OPENAI_CHAT_MODEL, promptVersion: ESSAY_GRADING_PROMPT_VERSION }).returning();
  if (!run) throw new Error("Não foi possível registrar a correção.");
  await db.update(essaySubmissions).set({ status: EssaySubmissionStatus.GRADING }).where(eq(essaySubmissions.id, submissionId));

  try {
    const criteriaText = criteria.map((criterion) => `${criterion.code} (${criterion.maximumScore} pontos): ${criterion.description}`).join("\n");
    const model = new ChatOpenAI({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_CHAT_MODEL });
    const structured = model.withStructuredOutput(evaluationSchema, { name: "essay_evaluation" });
    const result = await structured.invoke(`Você é um avaliador pedagógico de redações. Avalie estritamente pela rubrica, justifique cada nota com evidências literais e não invente trechos. A nota é uma estimativa, não oficial.\n\nPROPOSTA:\n${assignment.prompt}\n\nRUBRICA:\n${criteriaText}\n\nREDAÇÃO:\n${submission.confirmedText}`);
    const criteriaByCode = new Map(criteria.map((criterion) => [criterion.code, criterion]));
    const scores = result.criteria.map((score) => {
      const criterion = criteriaByCode.get(score.code);
      if (!criterion) throw new Error(`Critério desconhecido: ${score.code}`);
      return { ...score, criterion, score: Math.min(score.score, criterion.maximumScore) };
    });
    const totalScore = scores.reduce((total, score) => total + score.score, 0);

    await db.transaction(async (transaction) => {
      const [evaluation] = await transaction.insert(essayEvaluations).values({
          submissionId,
          rubricId: assignment.rubricId,
          evaluatorIndex: (evaluationCount?.value ?? 0) + 1,
          status: EssayEvaluationStatus.COMPLETED,
          totalScore,
          summary: result.summary,
          strengths: result.strengths,
          improvementPlan: result.improvementPlan,
          model: aiEnv.OPENAI_CHAT_MODEL,
          promptVersion: ESSAY_GRADING_PROMPT_VERSION,
          completedAt: new Date(),
        }).returning();
      if (!evaluation) throw new Error("Não foi possível salvar a avaliação.");
      await transaction.insert(essayCriterionScores).values(scores.map((score) => ({ evaluationId: evaluation.id, criterionId: score.criterion.id, score: score.score, feedback: score.feedback, evidence: score.evidence, suggestions: score.suggestions })));
      const completedAt = new Date();
      await transaction.update(essaySubmissions).set({ status: EssaySubmissionStatus.GRADED, finalEvaluationId: evaluation.id, gradedAt: completedAt }).where(eq(essaySubmissions.id, submissionId));
      await transaction.update(aiRuns).set({ status: RunStatus.SUCCEEDED, completedAt }).where(eq(aiRuns.id, run.id));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na correção.";
    await db.transaction(async (transaction) => {
      await transaction.update(essaySubmissions).set({ status: EssaySubmissionStatus.FAILED }).where(eq(essaySubmissions.id, submissionId));
      await transaction.update(aiRuns).set({ status: RunStatus.FAILED, errorMessage: message, completedAt: new Date() }).where(eq(aiRuns.id, run.id));
    });
    throw error;
  }
}
