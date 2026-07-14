import { beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let createLuminaTools: typeof import("@/lib/server/ai/lumina-tools").createLuminaTools;

beforeAll(async () => {
  ({ createLuminaTools } = await import("@/lib/server/ai/lumina-tools"));
});

describe("ferramentas da Lumina", () => {
  test("registra a pesquisa web nativa da OpenAI", () => {
    const tools = createLuminaTools(crypto.randomUUID());

    expect(tools.some((candidate) => "type" in candidate && candidate.type === "web_search")).toBe(true);
  });
});
