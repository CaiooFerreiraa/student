import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasAiConfiguration } from "@/lib/server/env";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";
import { runLumina } from "@/lib/server/ai/run-lumina";

const inputSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4_000),
});

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  if (!hasAiConfiguration()) return Response.json({ data: null, error: "OPENAI_API_KEY não configurada." }, { status: 503 });
  const user = await getCurrentUser();
  const input = inputSchema.parse(await request.json());
  const conversation = input.conversationId
    ? await prisma.conversation.findFirst({ where: { id: input.conversationId, userId: user.id } })
    : await prisma.conversation.create({ data: { userId: user.id, title: input.message.slice(0, 100) } });
  if (!conversation) return Response.json({ data: null, error: "Conversa não encontrada." }, { status: 404 });
  const message = await runLumina(user.id, conversation.id, input.message);
  return Response.json({ data: { conversationId: conversation.id, message }, error: null });
});
