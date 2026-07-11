import "server-only";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { AiFeature, MessageRole, RunStatus } from "@/generated/prisma/enums";
import { getAiEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";
import { LUMINA_PROMPT_VERSION, LUMINA_SYSTEM_PROMPT } from "@/lib/server/ai/lumina-prompt";
import { createLuminaTools } from "@/lib/server/ai/lumina-tools";

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => {
    if (typeof part === "string") return part;
    if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
    return "";
  }).join("\n").trim();
  return "";
}

export async function runLumina(userId: string, conversationId: string, userMessage: string) {
  const aiEnv = getAiEnv();
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, userId } });
  if (!conversation) throw new Error("Conversa não encontrada.");

  await prisma.conversationMessage.create({
    data: { conversationId, role: MessageRole.USER, content: userMessage },
  });
  const history = await prisma.conversationMessage.findMany({
    where: { conversationId, role: { in: [MessageRole.USER, MessageRole.ASSISTANT] } },
    orderBy: { createdAt: "asc" },
    take: 30,
    select: { role: true, content: true },
  });

  const run = await prisma.aiRun.create({
    data: {
      userId,
      feature: AiFeature.CHAT,
      targetType: "Conversation",
      targetId: conversationId,
      status: RunStatus.RUNNING,
      model: aiEnv.OPENAI_CHAT_MODEL,
      promptVersion: LUMINA_PROMPT_VERSION,
    },
  });
  const startedAt = performance.now();

  try {
    const model = new ChatOpenAI({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_CHAT_MODEL });
    const agent = createAgent({ model, tools: createLuminaTools(userId), systemPrompt: LUMINA_SYSTEM_PROMPT });
    const result = await agent.invoke({
      messages: history.map((message) => ({ role: message.role === MessageRole.USER ? "user" as const : "assistant" as const, content: message.content })),
    });
    const finalMessage = result.messages.at(-1);
    const text = messageText(finalMessage?.content);
    if (!text) throw new Error("A Lumina não retornou uma resposta textual.");

    const stored = await prisma.conversationMessage.create({
      data: { conversationId, role: MessageRole.ASSISTANT, content: text },
    });
    await prisma.$transaction([
      prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.SUCCEEDED, latencyMs: Math.round(performance.now() - startedAt), completedAt: new Date() } }),
      prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
    return stored;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    await prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.FAILED, errorMessage: message, latencyMs: Math.round(performance.now() - startedAt), completedAt: new Date() } });
    throw error;
  }
}
