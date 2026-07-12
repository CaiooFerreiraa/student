import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { essaySubmissions } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const schema = z.object({ text: z.string().trim().min(1).max(30_000) });

export const PATCH = withApiErrorBoundary(async (request: Request, context: RouteContext<"/api/essays/submissions/[id]/confirm">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const input = schema.parse(await request.json());
  const [updated] = await db.update(essaySubmissions).set({ confirmedText: input.text, confirmedAt: new Date(), status: "READY_TO_GRADE" }).where(and(eq(essaySubmissions.id, id), eq(essaySubmissions.userId, user.id))).returning();
  if (!updated) return Response.json({ data: null, error: "Submissão não encontrada." }, { status: 404 });
  return Response.json({ data: updated, error: null });
});
