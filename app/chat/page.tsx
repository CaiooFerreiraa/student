import { ChatWorkspace, type ChatMessage, type ChatMaterial } from "@/components/chat-workspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasAiConfiguration } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  const [conversation, materialRows] = await Promise.all([
    prisma.conversation.findFirst({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, include: { messages: { where: { role: { in: ["USER", "ASSISTANT"] } }, orderBy: { createdAt: "asc" }, take: 50 } } }),
    prisma.material.findMany({ where: { ownerId: user.id, processingStatus: "READY", deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, title: true, type: true, pageCount: true } }),
  ]);
  const messages: ChatMessage[] = conversation?.messages.map((message) => ({ id: message.id, role: message.role === "USER" ? "user" : "assistant", text: message.content, createdAt: message.createdAt.toISOString() })) ?? [];
  const materials: ChatMaterial[] = materialRows;
  return <ChatWorkspace initialConversationId={conversation?.id ?? null} initialMessages={messages} materials={materials} aiEnabled={hasAiConfiguration()} />;
}
