import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import { MaterialsLibrary, type MaterialListItem } from "@/components/materials-library";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { fileAssets, materialChunks, materials as materialTable, subjects } from "@/lib/server/db/schema";
import { hasBlobConfiguration } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  await auth.protect();
  const user = await getCurrentUser();
  const rows = await db.select({ material: materialTable, file: fileAssets, subject: subjects, chunkCount: sql<number>`(select count(*)::int from ${materialChunks} where ${materialChunks.materialId} = ${materialTable.id})` })
    .from(materialTable).innerJoin(fileAssets, eq(materialTable.fileId, fileAssets.id)).leftJoin(subjects, eq(materialTable.subjectId, subjects.id))
    .where(and(eq(materialTable.ownerId, user.id), isNull(materialTable.deletedAt))).orderBy(desc(materialTable.createdAt));
  const materials: MaterialListItem[] = rows.map((row) => ({
    id: row.material.id,
    title: row.material.title,
    subject: row.subject?.name ?? "Sem disciplina",
    size: row.file.byteSize,
    type: row.material.type,
    status: row.material.processingStatus,
    pageCount: row.material.pageCount,
    chunkCount: row.chunkCount,
    error: row.material.processingError,
    createdAt: row.material.createdAt.toISOString(),
  }));
  return <div>
    <PageHeader eyebrow="Biblioteca" title="Seus materiais" description="Envie documentos, acompanhe o processamento e use o conteúdo em quizzes e conversas." icon={BookOpen} />
    <MaterialsLibrary userId={user.id} initialMaterials={materials} blobEnabled={hasBlobConfiguration()} />
  </div>;
}
