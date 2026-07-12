import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { EssayType } from "@/domain/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { essayAssignments, essayRubrics } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const schema = z.object({ title: z.string().trim().min(3).max(180), prompt: z.string().trim().min(20).max(10_000), essayType: z.enum(EssayType).default(EssayType.ENEM), rubricId: z.string().uuid(), subjectId: z.string().uuid().optional(), minimumLines: z.number().int().min(1).max(100).optional(), maximumLines: z.number().int().min(1).max(100).optional(), timeLimitSeconds: z.number().int().min(60).max(14_400).optional() });

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const assignments = await db.query.essayAssignments.findMany({ where: and(eq(essayAssignments.ownerId, user.id), isNull(essayAssignments.deletedAt)), orderBy: [desc(essayAssignments.updatedAt)], with: { essayRubric: true } });
  return Response.json({ data: assignments.map((item) => ({ ...item, rubric: item.essayRubric })), error: null });
});

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  const input = schema.parse(await request.json());
  const [rubric] = await db.select().from(essayRubrics).where(and(eq(essayRubrics.id, input.rubricId), or(eq(essayRubrics.ownerId, user.id), isNull(essayRubrics.ownerId)), eq(essayRubrics.isActive, true))).limit(1);
  if (!rubric) return Response.json({ data: null, error: "Rubrica inválida." }, { status: 400 });
  const [assignment] = await db.insert(essayAssignments).values({ ...input, ownerId: user.id, updatedAt: new Date() }).returning();
  return Response.json({ data: assignment, error: null }, { status: 201 });
});
