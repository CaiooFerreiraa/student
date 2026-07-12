import "server-only";
import "pdf-parse/worker";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PDFParse } from "pdf-parse";

export type LoadedDocument = {
  pageContent: string;
  metadata: Record<string, unknown>;
};

const loadPdfParseV2 = async () => ({
  isV2: true as const,
  PDFParse,
});

export async function loadDocumentsFromFile(file: Blob, contentType: string): Promise<LoadedDocument[]> {
  if (contentType === "application/pdf") {
    return new PDFLoader(file, {
      splitPages: true,
      pdfjs: loadPdfParseV2,
    }).load();
  }

  if (contentType.includes("wordprocessingml")) {
    return new DocxLoader(file, { type: "docx" }).load();
  }

  if (contentType.startsWith("text/")) {
    return [{ pageContent: await file.text(), metadata: {} }];
  }

  throw new Error("Este tipo de material não oferece extração textual automática.");
}
