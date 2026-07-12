import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { EssayInputType } from "@/domain/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { essayAssignments, essaySubmissions } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const inputSchema = z.object({ assignmentId: z.string().uuid(), inputType: z.enum(EssayInputType), text: z.string().max(30_000).optional() });

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  const input = inputSchema.parse(await request.json());
  const [assignment] = await db.select().from(essayAssignments).where(and(eq(essayAssignments.id, input.assignmentId), eq(essayAssignments.ownerId, user.id), isNull(essayAssignments.deletedAt))).limit(1);
  if (!assignment) return Response.json({ data: null, error: "Proposta não encontrada." }, { status: 404 });
  const [submission] = await db.insert(essaySubmissions).values({ assignmentId: assignment.id, userId: user.id, inputType: input.inputType, originalText: input.text }).returning();
  return Response.json({ data: submission, error: null }, { status: 201 });
});
