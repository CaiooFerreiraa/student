import { auth } from "@clerk/nextjs/server";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { PenLine } from "lucide-react";
import { EssayWorkspace, type EssayAssignmentItem, type EssayRubricItem, type EssaySubmissionItem } from "@/components/essay-workspace";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { essayAssignments, essayRubrics, essaySubmissions } from "@/lib/server/db/schema";
import { hasAiConfiguration, hasBlobConfiguration } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export default async function EssaysPage() {
  await auth.protect();
  const user = await getCurrentUser();
  const [assignments, submissions, rubrics] = await Promise.all([
    db.query.essayAssignments.findMany({ where: (table, { and, eq, isNull }) => and(eq(table.ownerId, user.id), isNull(table.deletedAt)), orderBy: [desc(essayAssignments.updatedAt)], with: { essayRubric: true } }),
    db.query.essaySubmissions.findMany({ where: eq(essaySubmissions.userId, user.id), orderBy: [desc(essaySubmissions.startedAt)], limit: 20, with: { essayAssignment: true, essayEvaluation: true } }),
    db.select({ id: essayRubrics.id, name: essayRubrics.name, version: essayRubrics.version, type: essayRubrics.essayType, maximumScore: essayRubrics.maximumScore }).from(essayRubrics)
      .where(and(eq(essayRubrics.isActive, true), or(eq(essayRubrics.ownerId, user.id), isNull(essayRubrics.ownerId))))
      .orderBy(asc(essayRubrics.name), desc(essayRubrics.version)),
  ]);
  const assignmentItems: EssayAssignmentItem[] = assignments.map((item) => ({ id: item.id, title: item.title, prompt: item.prompt, type: item.essayType, rubric: `${item.essayRubric.name} ${item.essayRubric.version}`, maximumScore: item.essayRubric.maximumScore }));
  const rubricItems: EssayRubricItem[] = rubrics;
  const submissionItems: EssaySubmissionItem[] = submissions.map((item) => ({ id: item.id, assignmentTitle: item.essayAssignment.title, inputType: item.inputType, status: item.status, score: item.essayEvaluation?.totalScore ?? null, startedAt: item.startedAt.toISOString() }));
  return <div><PageHeader eyebrow="Produção textual" title="Redações" description="Envie texto, DOCX ou fotos de uma redação manuscrita, revise a transcrição e receba uma correção estruturada." icon={PenLine} /><EssayWorkspace userId={user.id} assignments={assignmentItems} rubrics={rubricItems} initialSubmissions={submissionItems} blobEnabled={hasBlobConfiguration()} aiEnabled={hasAiConfiguration()} /></div>;
}
