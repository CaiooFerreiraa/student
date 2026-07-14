import { asc, and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { subjects } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { resolveOwnedSubject } from "@/lib/server/subjects/resolve-subject";

const createSubjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const rows = await db.select().from(subjects).where(or(eq(subjects.ownerId, user.id), isNull(subjects.ownerId))).orderBy(asc(subjects.name));
  return Response.json({ data: rows, error: null });
});

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  const input = createSubjectSchema.parse(await request.json());
  const subjectId = await resolveOwnedSubject(user.id, input.name);
  const [subject] = await db.select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.ownerId, user.id)))
    .limit(1);
  if (!subject) throw new Error("Não foi possível carregar a matéria criada.");
  return Response.json({ data: subject, error: null }, { status: 201 });
});
