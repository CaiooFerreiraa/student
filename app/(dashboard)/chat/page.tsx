import { auth } from "@clerk/nextjs/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { ChatWorkspace, type ChatMessage, type ChatMaterial } from "@/components/chat-workspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { conversationMessages, conversations, materials as materialTable } from "@/lib/server/db/schema";
import { hasAiConfiguration } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await auth.protect();
  const user = await getCurrentUser();
  const [conversation, materialRows] = await Promise.all([
    db.query.conversations.findFirst({
      where: and(eq(conversations.userId, user.id), eq(conversations.status, "ACTIVE")),
      orderBy: [desc(conversations.updatedAt)],
      with: { conversationMessages: { where: (table, { inArray }) => inArray(table.role, ["USER", "ASSISTANT"]), orderBy: [asc(conversationMessages.createdAt)], limit: 50 } },
    }),
    db.select({ id: materialTable.id, title: materialTable.title, type: materialTable.type, pageCount: materialTable.pageCount }).from(materialTable)
      .where(and(eq(materialTable.ownerId, user.id), eq(materialTable.processingStatus, "READY"), isNull(materialTable.deletedAt)))
      .orderBy(desc(materialTable.updatedAt)).limit(10),
  ]);
  const messages: ChatMessage[] = conversation?.conversationMessages.map((message) => ({ id: message.id, role: message.role === "USER" ? "user" : "assistant", text: message.content, createdAt: message.createdAt.toISOString() })) ?? [];
  const materials: ChatMaterial[] = materialRows;
  return <ChatWorkspace initialConversationId={conversation?.id ?? null} initialMessages={messages} materials={materials} aiEnabled={hasAiConfiguration()} />;
}
