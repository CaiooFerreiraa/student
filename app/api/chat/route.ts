import { z } from "zod";
import { runLumina } from "@/lib/server/ai/run-lumina";
import { findActiveConversation } from "@/lib/server/chat/conversation-repository";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { conversations } from "@/lib/server/db/schema";
import { hasAiConfiguration } from "@/lib/server/env";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const inputSchema = z.object({ conversationId: z.string().uuid().optional(), message: z.string().trim().min(1).max(4_000) });

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  if (!hasAiConfiguration()) return Response.json({ data: null, error: "OPENAI_API_KEY não configurada." }, { status: 503 });
  const input = inputSchema.parse(await request.json());
  const currentConversation = input.conversationId
    ? await findActiveConversation(user.id, input.conversationId)
    : (await db.insert(conversations).values({
        userId: user.id,
        title: input.message.slice(0, 100),
        updatedAt: new Date(),
      }).returning())[0];
  if (!currentConversation) return Response.json({ data: null, error: "Conversa não encontrada." }, { status: 404 });
  const message = await runLumina(user.id, currentConversation.id, input.message);
  return Response.json({
    data: {
      conversation: {
        id: currentConversation.id,
        title: currentConversation.title,
        preview: message.content,
        updatedAt: message.createdAt.toISOString(),
      },
      message: { ...message, createdAt: message.createdAt.toISOString() },
    },
    error: null,
  });
});
