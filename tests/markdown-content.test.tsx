import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "@/components/ui/markdown-content";

describe("conteúdo Markdown do chat", () => {
  test("renderiza negrito e listas como elementos HTML", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent>{"Um **verbo**:\n\n- falar\n- escrever"}</MarkdownContent>,
    );

    expect(html).toContain("<strong");
    expect(html).toContain(">verbo</strong>");
    expect(html).toContain("<ul");
    expect(html).not.toContain("**verbo**");
  });

  test("não executa HTML enviado na mensagem", () => {
    const html = renderToStaticMarkup(
      <MarkdownContent>{"Texto <script>alert('xss')</script> seguro"}</MarkdownContent>,
    );

    expect(html).not.toContain("<script");
    expect(html).toContain("alert(&#x27;xss&#x27;)");
  });
});
