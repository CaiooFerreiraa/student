import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { PenLine } from "lucide-react";
import { EssayWorkspace, type EssayAssignmentItem, type EssaySubmissionItem } from "@/components/essay-workspace";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { essayAssignments, essaySubmissions } from "@/lib/server/db/schema";
import { hasAiConfiguration, hasBlobConfiguration } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export default async function EssaysPage() {
  await auth.protect();
  const user = await getCurrentUser();
  const [assignments, submissions] = await Promise.all([
    db.query.essayAssignments.findMany({ where: (table, { and, eq, isNull }) => and(eq(table.ownerId, user.id), isNull(table.deletedAt)), orderBy: [desc(essayAssignments.updatedAt)], with: { essayRubric: true } }),
    db.query.essaySubmissions.findMany({ where: eq(essaySubmissions.userId, user.id), orderBy: [desc(essaySubmissions.startedAt)], limit: 20, with: { essayAssignment: true, essayEvaluation: true } }),
  ]);
  const assignmentItems: EssayAssignmentItem[] = assignments.map((item) => ({ id: item.id, title: item.title, prompt: item.prompt, type: item.essayType, rubric: `${item.essayRubric.name} ${item.essayRubric.version}`, maximumScore: item.essayRubric.maximumScore }));
  const submissionItems: EssaySubmissionItem[] = submissions.map((item) => ({ id: item.id, assignmentTitle: item.essayAssignment.title, inputType: item.inputType, status: item.status, score: item.essayEvaluation?.totalScore ?? null, startedAt: item.startedAt.toISOString() }));
  return <div><PageHeader eyebrow="Produção textual" title="Redações" description="Envie texto, DOCX ou fotos de uma redação manuscrita, revise a transcrição e receba uma correção estruturada." icon={PenLine} /><EssayWorkspace userId={user.id} assignments={assignmentItems} initialSubmissions={submissionItems} blobEnabled={hasBlobConfiguration()} aiEnabled={hasAiConfiguration()} /></div>;
}
