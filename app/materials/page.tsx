import { BookOpen } from "lucide-react";
import { MaterialsLibrary, type MaterialListItem } from "@/components/materials-library";
import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasBlobConfiguration } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export default async function MaterialsPage() {
  const user = await getCurrentUser();
  const rows = await prisma.material.findMany({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { file: true, subject: true, _count: { select: { chunks: true } } },
  });
  const materials: MaterialListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    subject: row.subject?.name ?? "Sem disciplina",
    size: Number(row.file.byteSize),
    type: row.type,
    status: row.processingStatus,
    pageCount: row.pageCount,
    chunkCount: row._count.chunks,
    error: row.processingError,
    createdAt: row.createdAt.toISOString(),
  }));
  return <div>
    <PageHeader eyebrow="Biblioteca" title="Seus materiais" description="Envie documentos, acompanhe o processamento e use o conteúdo em quizzes e conversas." icon={BookOpen} />
    <MaterialsLibrary userId={user.id} initialMaterials={materials} blobEnabled={hasBlobConfiguration()} />
  </div>;
}
