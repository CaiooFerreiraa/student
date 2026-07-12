import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { isUniqueViolation } from "@/lib/server/db/errors";
import { subjects } from "@/lib/server/db/schema";

export function subjectSlug(name: string): string {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
}

async function findSubjectId(userId: string, slug: string): Promise<string | null> {
  const [subject] = await db.select({ id: subjects.id }).from(subjects)
    .where(and(eq(subjects.ownerId, userId), eq(subjects.slug, slug))).limit(1);
  return subject?.id ?? null;
}

export async function resolveOwnedSubject(userId: string, name: string): Promise<string> {
  const normalizedName = name.trim().replace(/\s+/g, " ");
  const slug = subjectSlug(normalizedName);
  if (!slug) throw new Error("Informe uma matéria válida.");
  const existingId = await findSubjectId(userId, slug);
  if (existingId) return existingId;

  try {
    const [subject] = await db.insert(subjects).values({ ownerId: userId, name: normalizedName, slug }).returning({ id: subjects.id });
    if (!subject) throw new Error("Não foi possível criar a matéria.");
    return subject.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const concurrentId = await findSubjectId(userId, slug);
    if (!concurrentId) throw error;
    return concurrentId;
  }
}
