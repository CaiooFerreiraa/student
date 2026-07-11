import { z } from "zod";
import { EssayInputType } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";

const inputSchema = z.object({ assignmentId: z.string().uuid(), inputType: z.enum(EssayInputType), text: z.string().max(30_000).optional() });

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  const input = inputSchema.parse(await request.json());
  const assignment = await prisma.essayAssignment.findFirst({ where: { id: input.assignmentId, ownerId: user.id, deletedAt: null } });
  if (!assignment) return Response.json({ data: null, error: "Proposta não encontrada." }, { status: 404 });
  const submission = await prisma.essaySubmission.create({ data: { assignmentId: assignment.id, userId: user.id, inputType: input.inputType, originalText: input.text } });
  return Response.json({ data: submission, error: null }, { status: 201 });
});
