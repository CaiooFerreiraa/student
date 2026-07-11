import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/server/prisma";

export function subjectSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export async function resolveOwnedSubject(userId: string, name: string): Promise<string> {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const slug = subjectSlug(normalizedName);
  if (!slug) throw new Error("Informe uma matéria válida.");

  const existing = await prisma.subject.findUnique({ where: { ownerId_slug: { ownerId: userId, slug } } });
  if (existing) return existing.id;

  try {
    const subject = await prisma.subject.create({ data: { ownerId: userId, name: normalizedName, slug } });
    return subject.id;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const concurrent = await prisma.subject.findUnique({ where: { ownerId_slug: { ownerId: userId, slug } } });
    if (!concurrent) throw error;
    return concurrent.id;
  }
}
