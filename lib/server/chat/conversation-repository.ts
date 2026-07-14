import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import type { ChatConversation, ChatMessage } from "@/domain/chat/models";
import { db } from "@/lib/server/db";
import { conversationMessages, conversations } from "@/lib/server/db/schema";

const visibleRoles = ["USER", "ASSISTANT"] as const;

function summarizeConversation(row: {
  id: string;
  title: string;
  updatedAt: Date;
  conversationMessages: Array<{ content: string }>;
}): ChatConversation {
  return {
    id: row.id,
    title: row.title,
    preview: row.conversationMessages[0]?.content ?? "Conversa iniciada",
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listChatConversations(userId: string): Promise<ChatConversation[]> {
  const rows = await db.query.conversations.findMany({
    where: and(eq(conversations.userId, userId), eq(conversations.status, "ACTIVE")),
    orderBy: [desc(conversations.updatedAt)],
    limit: 40,
    with: {
      conversationMessages: {
        where: (table, { inArray }) => inArray(table.role, visibleRoles),
        orderBy: [desc(conversationMessages.createdAt)],
        limit: 1,
        columns: { content: true },
      },
    },
  });

  return rows.map(summarizeConversation);
}

export async function getChatConversation(
  userId: string,
  conversationId: string,
): Promise<{ conversation: ChatConversation; messages: ChatMessage[] } | null> {
  const row = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, conversationId),
      eq(conversations.userId, userId),
      eq(conversations.status, "ACTIVE"),
    ),
    with: {
      conversationMessages: {
        where: (table, { inArray }) => inArray(table.role, visibleRoles),
        orderBy: [asc(conversationMessages.createdAt)],
        limit: 100,
        columns: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });
  if (!row) return null;

  const messages: ChatMessage[] = row.conversationMessages.map((message) => ({
    id: message.id,
    role: message.role === "USER" ? "user" : "assistant",
    text: message.content,
    createdAt: message.createdAt.toISOString(),
  }));
  const latestMessage = row.conversationMessages.at(-1);

  return {
    conversation: {
      id: row.id,
      title: row.title,
      preview: latestMessage?.content ?? "Conversa iniciada",
      updatedAt: row.updatedAt.toISOString(),
    },
    messages,
  };
}

export async function findActiveConversation(userId: string, conversationId: string) {
  const [conversation] = await db.select().from(conversations).where(and(
    eq(conversations.id, conversationId),
    eq(conversations.userId, userId),
    eq(conversations.status, "ACTIVE"),
  )).limit(1);
  return conversation ?? null;
}
