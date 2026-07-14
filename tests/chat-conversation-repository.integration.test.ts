import { beforeAll, describe, expect, mock, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let getChatConversation: typeof import("@/lib/server/chat/conversation-repository").getChatConversation;
let listChatConversations: typeof import("@/lib/server/chat/conversation-repository").listChatConversations;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");

beforeAll(async () => {
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ getChatConversation, listChatConversations } = await import("@/lib/server/chat/conversation-repository"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
});

describe("repositório de conversas do chat", () => {
  test("lista assuntos recentes, carrega mensagens e respeita o proprietário", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const olderDate = new Date("2026-01-01T10:00:00.000Z");
    const newerDate = new Date("2026-01-02T10:00:00.000Z");
    const created = await db.insert(tables.conversations).values([
      { userId: user.id, title: `${nonce} Biologia`, updatedAt: olderDate },
      { userId: user.id, title: `${nonce} História`, updatedAt: newerDate },
    ]).returning();
    const ids = created.map((conversation) => conversation.id);

    try {
      const biology = created.find((conversation) => conversation.title.endsWith("Biologia"));
      const history = created.find((conversation) => conversation.title.endsWith("História"));
      if (!biology || !history) throw new Error("Fixtures de conversa não criadas.");

      await db.insert(tables.conversationMessages).values([
        { conversationId: biology.id, role: "USER", content: "Explique mitose.", createdAt: olderDate },
        { conversationId: history.id, role: "USER", content: "O que foi a República Velha?", createdAt: newerDate },
        { conversationId: history.id, role: "ASSISTANT", content: "Foi um período da história brasileira.", createdAt: new Date("2026-01-02T10:01:00.000Z") },
      ]);

      const list = (await listChatConversations(user.id)).filter((conversation) => conversation.title.startsWith(nonce));
      const detail = await getChatConversation(user.id, history.id);
      const inaccessible = await getChatConversation(crypto.randomUUID(), history.id);

      expect(list.map((conversation) => conversation.id)).toEqual([history.id, biology.id]);
      expect(list[0]?.preview).toBe("Foi um período da história brasileira.");
      expect(detail?.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(inaccessible).toBeNull();
    } finally {
      if (ids.length) {
        await db.delete(tables.conversationMessages).where(inArray(tables.conversationMessages.conversationId, ids));
        await db.delete(tables.conversations).where(and(
          eq(tables.conversations.userId, user.id),
          inArray(tables.conversations.id, ids),
        ));
      }
    }
  });
});
