export type WebCitation = {
  title: string;
  url: string;
};

export type FormattedAssistantMessage = {
  text: string;
  citations: WebCitation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeWebUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function markdownLabel(value: string): string {
  return value.replace(/[\\[\]]/g, "\\$&").trim();
}

function readCitation(value: unknown): WebCitation | null {
  if (!isRecord(value)) return null;
  const isUrlCitation = value.type === "url_citation"
    || (value.type === "citation" && value.source === "url_citation");
  if (!isUrlCitation) return null;

  const url = safeWebUrl(value.url);
  if (!url) return null;

  return {
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : new URL(url).hostname,
    url,
  };
}

export function formatAssistantMessage(content: unknown): FormattedAssistantMessage {
  if (typeof content === "string") return { text: content.trim(), citations: [] };
  if (!Array.isArray(content)) return { text: "", citations: [] };

  const textParts: string[] = [];
  const citations = new Map<string, WebCitation>();

  for (const part of content) {
    if (typeof part === "string") {
      textParts.push(part);
      continue;
    }
    if (!isRecord(part)) continue;
    if (typeof part.text === "string") textParts.push(part.text);
    if (!Array.isArray(part.annotations)) continue;

    for (const annotation of part.annotations) {
      const citation = readCitation(annotation);
      if (citation) citations.set(citation.url, citation);
    }
  }

  const text = textParts.join("\n").trim();
  const sources = [...citations.values()];
  if (!sources.length) return { text, citations: [] };

  const sourceList = sources
    .map((source) => `- [${markdownLabel(source.title)}](${source.url})`)
    .join("\n");

  return {
    text: `${text}\n\n### Fontes consultadas\n${sourceList}`.trim(),
    citations: sources,
  };
}
