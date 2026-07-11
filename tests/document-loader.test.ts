import { beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let loadDocumentsFromFile: typeof import("@/lib/server/materials/document-loader").loadDocumentsFromFile;

beforeAll(async () => {
  ({ loadDocumentsFromFile } = await import("@/lib/server/materials/document-loader"));
});

function createTextPdf(text: string): string {
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n(${text.replace(/[()\\]/g, "\\$&")}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

describe("extração de documentos", () => {
  test("extrai texto e página de um PDF real com pdf-parse v2", async () => {
    const file = new Blob([createTextPdf("Lumina PDF integration")], { type: "application/pdf" });

    const documents = await loadDocumentsFromFile(file, "application/pdf");

    expect(documents).toHaveLength(1);
    expect(documents[0]?.pageContent).toContain("Lumina PDF integration");
    expect(documents[0]?.metadata).toMatchObject({ loc: { pageNumber: 1 } });
  });
});
