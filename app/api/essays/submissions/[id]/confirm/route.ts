import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";

const schema = z.object({ text: z.string().trim().min(1).max(30_000) });

export async function PATCH(request: Request, context: RouteContext<"/api/essays/submissions/[id]/confirm">): Promise<Response> {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const input = schema.parse(await request.json());
  const submission = await prisma.essaySubmission.findFirst({ where: { id, userId: user.id } });
  if (!submission) return Response.json({ data: null, error: "Submissão não encontrada." }, { status: 404 });
  const updated = await prisma.essaySubmission.update({ where: { id }, data: { confirmedText: input.text, confirmedAt: new Date(), status: "READY_TO_GRADE" } });
  return Response.json({ data: updated, error: null });
}
