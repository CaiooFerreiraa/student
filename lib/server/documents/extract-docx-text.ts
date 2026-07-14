import "server-only";
import mammoth from "mammoth";

export async function extractDocxText(bytes: ArrayBuffer): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: bytes });
  return result.value;
}
