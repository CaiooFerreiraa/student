import { auth } from "@clerk/nextjs/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { ChatWorkspace, type ChatMaterial } from "@/components/chat-workspace";
import { getCurrentUser } from "@/lib/server/current-user";
import { getChatConversation, listChatConversations } from "@/lib/server/chat/conversation-repository";
import { db } from "@/lib/server/db";
import { materials as materialTable } from "@/lib/server/db/schema";
import { hasAiConfiguration } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await auth.protect();
  const user = await getCurrentUser();
  const [conversationList, materialRows] = await Promise.all([
    listChatConversations(user.id),
    db.select({ id: materialTable.id, title: materialTable.title, type: materialTable.type, pageCount: materialTable.pageCount }).from(materialTable)
      .where(and(eq(materialTable.ownerId, user.id), eq(materialTable.processingStatus, "READY"), isNull(materialTable.deletedAt)))
      .orderBy(desc(materialTable.updatedAt)).limit(10),
  ]);
  const activeConversation = conversationList[0]
    ? await getChatConversation(user.id, conversationList[0].id)
    : null;
  const materials: ChatMaterial[] = materialRows;
  return (
    <ChatWorkspace
      initialConversations={conversationList}
      initialConversation={activeConversation}
      materials={materials}
      aiEnabled={hasAiConfiguration()}
      renderedAt={new Date().toISOString()}
    />
  );
}
