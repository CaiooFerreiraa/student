import "server-only";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { and, asc, eq, inArray } from "drizzle-orm";
import { AiFeature, MessageRole, RunStatus } from "@/domain/enums";
import { formatAssistantMessage } from "@/domain/chat/assistant-message";
import { db } from "@/lib/server/db";
import { aiRuns, conversationMessages, conversations } from "@/lib/server/db/schema";
import { getAiEnv } from "@/lib/server/env";
import { LUMINA_PROMPT_VERSION, LUMINA_SYSTEM_PROMPT } from "@/lib/server/ai/lumina-prompt";
import { createLuminaTools } from "@/lib/server/ai/lumina-tools";

export async function runLumina(userId: string, conversationId: string, userMessage: string) {
  const aiEnv = getAiEnv();
  const [conversation] = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId))).limit(1);
  if (!conversation) throw new Error("Conversa não encontrada.");

  await db.insert(conversationMessages).values({ conversationId, role: MessageRole.USER, content: userMessage });
  const history = await db.select({ role: conversationMessages.role, content: conversationMessages.content }).from(conversationMessages)
    .where(and(eq(conversationMessages.conversationId, conversationId), inArray(conversationMessages.role, [MessageRole.USER, MessageRole.ASSISTANT])))
    .orderBy(asc(conversationMessages.createdAt)).limit(30);

  const [run] = await db.insert(aiRuns).values({
      userId,
      feature: AiFeature.CHAT,
      targetType: "Conversation",
      targetId: conversationId,
      status: RunStatus.RUNNING,
      model: aiEnv.OPENAI_CHAT_MODEL,
      promptVersion: LUMINA_PROMPT_VERSION,
    }).returning();
  if (!run) throw new Error("Não foi possível registrar a execução da IA.");
  const startedAt = performance.now();

  try {
    const model = new ChatOpenAI({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_CHAT_MODEL });
    const agent = createAgent({ model, tools: createLuminaTools(userId), systemPrompt: LUMINA_SYSTEM_PROMPT });
    const result = await agent.invoke({
      messages: history.map((message) => ({ role: message.role === MessageRole.USER ? "user" as const : "assistant" as const, content: message.content })),
    });
    const finalMessage = result.messages.at(-1);
    const formatted = formatAssistantMessage(finalMessage?.content);
    if (!formatted.text) throw new Error("A Lumina não retornou uma resposta textual.");

    const [stored] = await db.insert(conversationMessages).values({
      conversationId,
      role: MessageRole.ASSISTANT,
      content: formatted.text,
      structuredData: formatted.citations.length ? { citations: formatted.citations } : null,
    }).returning();
    if (!stored) throw new Error("Não foi possível salvar a resposta.");
    const completedAt = new Date();
    await db.transaction(async (transaction) => {
      await transaction.update(aiRuns).set({ status: RunStatus.SUCCEEDED, latencyMs: Math.round(performance.now() - startedAt), completedAt }).where(eq(aiRuns.id, run.id));
      await transaction.update(conversations).set({ updatedAt: completedAt }).where(eq(conversations.id, conversationId));
    });
    return stored;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida.";
    await db.update(aiRuns).set({ status: RunStatus.FAILED, errorMessage: message, latencyMs: Math.round(performance.now() - startedAt), completedAt: new Date() }).where(eq(aiRuns.id, run.id));
    throw error;
  }
}
