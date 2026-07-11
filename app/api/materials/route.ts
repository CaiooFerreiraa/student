import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  const materials = await prisma.material.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { createdAt: "desc" }, include: { file: true, subject: true } });
  return Response.json({ data: materials.map((material) => ({ id: material.id, title: material.title, type: material.type, status: material.processingStatus, size: Number(material.file.byteSize), subject: material.subject?.name ?? null })), error: null });
}
