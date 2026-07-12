import { asc, eq, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { subjects } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const rows = await db.select().from(subjects).where(or(eq(subjects.ownerId, user.id), isNull(subjects.ownerId))).orderBy(asc(subjects.name));
  return Response.json({ data: rows, error: null });
});
