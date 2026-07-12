import { and, asc, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { essayAssignments, essayCriterionScores, essayEvaluations, essayRubricCriteria, essaySubmissionFiles, essaySubmissions, essayTranscriptions, fileAssets } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

export const GET = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/essays/submissions/[id]">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const [row] = await db.select({ submission: essaySubmissions, assignment: essayAssignments }).from(essaySubmissions).innerJoin(essayAssignments, eq(essaySubmissions.assignmentId, essayAssignments.id)).where(and(eq(essaySubmissions.id, id), eq(essaySubmissions.userId, user.id))).limit(1);
  if (!row) return Response.json({ data: null, error: "Submissão não encontrada." }, { status: 404 });
  const [files, transcriptions, evaluationRows] = await Promise.all([
    db.select({ link: essaySubmissionFiles, file: fileAssets }).from(essaySubmissionFiles).innerJoin(fileAssets, eq(essaySubmissionFiles.fileId, fileAssets.id)).where(eq(essaySubmissionFiles.submissionId, id)).orderBy(asc(essaySubmissionFiles.position)),
    db.select().from(essayTranscriptions).where(eq(essayTranscriptions.submissionId, id)).orderBy(desc(essayTranscriptions.versionNumber)).limit(1),
    row.submission.finalEvaluationId ? db.select({ evaluation: essayEvaluations, score: essayCriterionScores, criterion: essayRubricCriteria }).from(essayEvaluations).leftJoin(essayCriterionScores, eq(essayCriterionScores.evaluationId, essayEvaluations.id)).leftJoin(essayRubricCriteria, eq(essayCriterionScores.criterionId, essayRubricCriteria.id)).where(eq(essayEvaluations.id, row.submission.finalEvaluationId)).orderBy(asc(essayRubricCriteria.position)) : Promise.resolve([]),
  ]);
  const evaluation = evaluationRows[0]?.evaluation;
  const finalEvaluation = evaluation ? { ...evaluation, scores: evaluationRows.flatMap(({ score, criterion }) => score && criterion ? [{ ...score, criterion }] : []) } : null;
  return Response.json({ data: {
    ...row.submission,
    assignment: row.assignment,
    files: files.map(({ link, file }) => ({ ...link, file: { id: file.id, originalName: file.originalName, contentType: file.contentType } })),
    transcriptions,
    finalEvaluation,
  }, error: null });
});
