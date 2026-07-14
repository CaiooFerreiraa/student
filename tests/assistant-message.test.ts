import { describe, expect, test } from "bun:test";
import { formatAssistantMessage } from "@/domain/chat/assistant-message";

describe("formatação da resposta do agente", () => {
  test("preserva uma resposta textual sem criar fontes inexistentes", () => {
    expect(formatAssistantMessage("Resposta baseada no contexto.")).toEqual({
      text: "Resposta baseada no contexto.",
      citations: [],
    });
  });

  test("transforma citações web da OpenAI em links Markdown únicos", () => {
    const result = formatAssistantMessage([{
      type: "text",
      text: "A informação foi atualizada recentemente.",
      annotations: [
        {
          type: "citation",
          source: "url_citation",
          title: "Fonte [oficial]",
          url: "https://example.com/atualizacao",
        },
        {
          type: "url_citation",
          title: "Fonte repetida",
          url: "https://example.com/atualizacao",
        },
      ],
    }]);

    expect(result.citations).toEqual([{
      title: "Fonte repetida",
      url: "https://example.com/atualizacao",
    }]);
    expect(result.text).toContain("### Fontes consultadas");
    expect(result.text).toContain("[Fonte repetida](https://example.com/atualizacao)");
  });

  test("descarta protocolos que não podem virar links externos", () => {
    const result = formatAssistantMessage([{
      text: "Resposta segura.",
      annotations: [{
        type: "url_citation",
        title: "Link inseguro",
        url: "javascript:alert(1)",
      }],
    }]);

    expect(result).toEqual({ text: "Resposta segura.", citations: [] });
  });
});
