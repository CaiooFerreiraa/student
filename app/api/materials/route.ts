import { after } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { fileAssets, materialChunks, materials, subjects } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { findRecoverableMaterialJobIds } from "@/lib/server/materials/material-job-repository";
import { processMaterialJob } from "@/lib/server/materials/process-material";

export const maxDuration = 300;

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const recoverableJobIds = await findRecoverableMaterialJobIds(user.id);
  if (recoverableJobIds.length > 0) {
    after(async () => {
      await Promise.allSettled(recoverableJobIds.map((materialId) => processMaterialJob(materialId)));
    });
  }
  const rows = await db.select({ material: materials, file: fileAssets, subject: subjects, chunkCount: sql<number>`(select count(*)::int from ${materialChunks} where ${materialChunks.materialId} = ${materials.id})` })
    .from(materials).innerJoin(fileAssets, eq(materials.fileId, fileAssets.id)).leftJoin(subjects, eq(materials.subjectId, subjects.id))
    .where(and(eq(materials.ownerId, user.id), isNull(materials.deletedAt))).orderBy(desc(materials.createdAt));
  return Response.json({ data: rows.map(({ material, file, subject, chunkCount }) => ({ id: material.id, title: material.title, type: material.type, status: material.processingStatus, size: file.byteSize, subject: subject?.name ?? "Sem matéria", pageCount: material.pageCount, chunkCount, error: material.processingError, createdAt: material.createdAt.toISOString() })), error: null });
});
