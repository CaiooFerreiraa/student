import { z } from "zod";
import { EssayType } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";

const schema = z.object({ title: z.string().trim().min(3).max(180), prompt: z.string().trim().min(20).max(10_000), essayType: z.enum(EssayType).default(EssayType.ENEM), rubricId: z.string().uuid(), subjectId: z.string().uuid().optional(), minimumLines: z.number().int().min(1).max(100).optional(), maximumLines: z.number().int().min(1).max(100).optional(), timeLimitSeconds: z.number().int().min(60).max(14_400).optional() });

export const GET = withApiErrorBoundary(async (): Promise<Response> => { const user = await getCurrentUser(); const assignments = await prisma.essayAssignment.findMany({ where: { ownerId: user.id, deletedAt: null }, orderBy: { updatedAt: "desc" }, include: { rubric: true } }); return Response.json({ data: assignments, error: null }); });
export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => { const user = await getCurrentUser(); const input = schema.parse(await request.json()); const rubric = await prisma.essayRubric.findFirst({ where: { id: input.rubricId, OR: [{ ownerId: user.id }, { ownerId: null }], isActive: true } }); if (!rubric) return Response.json({ data: null, error: "Rubrica inválida." }, { status: 400 }); const assignment = await prisma.essayAssignment.create({ data: { ...input, ownerId: user.id } }); return Response.json({ data: assignment, error: null }, { status: 201 }); });
