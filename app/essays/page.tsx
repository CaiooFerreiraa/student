import { PenLine } from "lucide-react";
import { EssayWorkspace, type EssayAssignmentItem, type EssaySubmissionItem } from "@/components/essay-workspace";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasAiConfiguration, hasBlobConfiguration } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export default async function EssaysPage() {
  const user = await getCurrentUser();
  const [assignments, submissions] = await Promise.all([
    prisma.essayAssignment.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { rubric: true } }),
    prisma.essaySubmission.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 20, include: { assignment: true, finalEvaluation: true } }),
  ]);
  const assignmentItems: EssayAssignmentItem[] = assignments.map((item) => ({ id: item.id, title: item.title, prompt: item.prompt, type: item.essayType, rubric: `${item.rubric.name} ${item.rubric.version}`, maximumScore: item.rubric.maximumScore }));
  const submissionItems: EssaySubmissionItem[] = submissions.map((item) => ({ id: item.id, assignmentTitle: item.assignment.title, inputType: item.inputType, status: item.status, score: item.finalEvaluation?.totalScore ?? null, startedAt: item.startedAt.toISOString() }));
  return <div><PageHeader eyebrow="Produção textual" title="Redações" description="Envie texto, DOCX ou fotos de uma redação manuscrita, revise a transcrição e receba uma correção estruturada." icon={PenLine} /><EssayWorkspace userId={user.id} assignments={assignmentItems} initialSubmissions={submissionItems} blobEnabled={hasBlobConfiguration()} aiEnabled={hasAiConfiguration()} /></div>;
}
