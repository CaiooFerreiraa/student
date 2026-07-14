import "server-only";
import "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { extractDocxText } from "@/lib/server/documents/extract-docx-text";

export type LoadedDocument = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

function readPdfVersion(info: unknown): string {
  if (
    typeof info === "object"
    && info !== null
    && "PDFFormatVersion" in info
    && typeof info.PDFFormatVersion === "string"
  ) {
    return info.PDFFormatVersion;
  }

  return "unknown";
}

async function loadPdfDocuments(file: Blob): Promise<LoadedDocument[]> {
  const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });

  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    return textResult.pages
      .filter((page) => page.text.trim().length > 0)
      .map((page) => ({
        pageContent: page.text,
        metadata: {
          pdf: {
            version: readPdfVersion(infoResult.info),
            info: infoResult.info,
            metadata: infoResult.metadata,
            totalPages: textResult.total,
          },
          loc: { pageNumber: page.num },
        },
      }));
  } finally {
    await parser.destroy();
  }
}

export async function loadDocumentsFromFile(file: Blob, contentType: string): Promise<LoadedDocument[]> {
  if (contentType === "application/pdf") {
    return loadPdfDocuments(file);
  }

  if (contentType.includes("wordprocessingml")) {
    const pageContent = await extractDocxText(await file.arrayBuffer());
    return pageContent ? [{ pageContent, metadata: {} }] : [];
  }

  if (contentType.startsWith("text/")) {
    return [{ pageContent: await file.text(), metadata: {} }];
  }

  throw new Error("Este tipo de material não oferece extração textual automática.");
}
