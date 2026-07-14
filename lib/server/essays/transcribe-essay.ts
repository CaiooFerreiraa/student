import "server-only";
import { get } from "@vercel/blob";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { AiFeature, EssayInputType, EssaySubmissionStatus, RunStatus } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { aiRuns, essaySubmissionFiles, essaySubmissions, essayTranscriptions } from "@/lib/server/db/schema";
import { extractDocxText } from "@/lib/server/documents/extract-docx-text";
import { getAiEnv, getBlobEnv } from "@/lib/server/env";

const transcriptionSchema = z.object({
  rawText: z.string(),
  normalizedText: z.string(),
  confidence: z.number().min(0).max(1),
  uncertainSegments: z.array(z.object({ excerpt: z.string(), reason: z.string() })),
});

export const ESSAY_TRANSCRIPTION_PROMPT_VERSION = "essay-transcription-v1";

async function privateBlob(pathname: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const env = getBlobEnv();
  const result = await get(pathname, { access: "private", token: env.BLOB_READ_WRITE_TOKEN });
  if (!result || result.statusCode === 304 || !result.stream) throw new Error("Arquivo da redação não encontrado.");
  return { bytes: await new Response(result.stream).arrayBuffer(), contentType: result.blob.contentType ?? "application/octet-stream" };
}

export async function transcribeEssaySubmission(userId: string, submissionId: string): Promise<void> {
  const submission = await db.query.essaySubmissions.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, submissionId), eq(table.userId, userId)),
    with: { essaySubmissionFiles: { orderBy: [asc(essaySubmissionFiles.position)], with: { fileAsset: true } }, essayTranscriptions: { orderBy: [desc(essayTranscriptions.versionNumber)], limit: 1 } },
  });
  if (!submission) throw new Error("Submissão não encontrada.");
  await db.update(essaySubmissions).set({ status: EssaySubmissionStatus.EXTRACTING }).where(eq(essaySubmissions.id, submissionId));
  const files = submission.essaySubmissionFiles;
  const latestVersion = submission.essayTranscriptions[0]?.versionNumber ?? 0;

  if (submission.inputType === EssayInputType.TEXT) {
    const text = submission.originalText?.trim();
    if (!text) throw new Error("A redação não possui texto.");
    await db.transaction(async (transaction) => {
      await transaction.insert(essayTranscriptions).values({ submissionId, versionNumber: latestVersion + 1, rawText: text, normalizedText: text, confidence: "1.0000", confirmedByUserAt: new Date() });
      await transaction.update(essaySubmissions).set({ confirmedText: text, confirmedAt: new Date(), status: EssaySubmissionStatus.READY_TO_GRADE }).where(eq(essaySubmissions.id, submissionId));
    });
    return;
  }

  if (files.length === 0) throw new Error("Nenhum arquivo foi enviado.");

  if (submission.inputType === EssayInputType.DOCX) {
    const source = await privateBlob(files[0]!.fileAsset.pathname);
    const text = (await extractDocxText(source.bytes)).trim();
    if (!text) throw new Error("Não foi possível extrair texto do DOCX.");
    await db.transaction(async (transaction) => {
      await transaction.insert(essayTranscriptions).values({ submissionId, versionNumber: latestVersion + 1, rawText: text, normalizedText: text, confidence: "1.0000" });
      await transaction.update(essaySubmissions).set({ status: EssaySubmissionStatus.NEEDS_REVIEW }).where(eq(essaySubmissions.id, submissionId));
    });
    return;
  }

  const aiEnv = getAiEnv();
  const [run] = await db.insert(aiRuns).values({ userId, feature: AiFeature.ESSAY_TRANSCRIPTION, targetType: "EssaySubmission", targetId: submissionId, status: RunStatus.RUNNING, model: aiEnv.OPENAI_CHAT_MODEL, promptVersion: ESSAY_TRANSCRIPTION_PROMPT_VERSION }).returning();
  if (!run) throw new Error("Não foi possível registrar a transcrição.");
  try {
    const imageParts: Array<{ type: "image_url"; image_url: { url: string; detail: "high" } }> = [];
    for (const entry of files) {
      const source = await privateBlob(entry.fileAsset.pathname);
      const base64 = Buffer.from(source.bytes).toString("base64");
      imageParts.push({ type: "image_url", image_url: { url: `data:${source.contentType};base64,${base64}`, detail: "high" } });
    }
    const model = new ChatOpenAI({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_CHAT_MODEL });
    const structured = model.withStructuredOutput(transcriptionSchema, { name: "essay_transcription" });
    const result = await structured.invoke([
      new SystemMessage("Transcreva fielmente a redação manuscrita. Preserve parágrafos, grafia e pontuação originais. Não corrija o texto. Marque trechos incertos e retorne confiança de 0 a 1."),
      new HumanMessage({ content: [{ type: "text", text: "As imagens estão em ordem. Transcreva todo o texto." }, ...imageParts] }),
    ]);
    await db.transaction(async (transaction) => {
      await transaction.insert(essayTranscriptions).values({ submissionId, versionNumber: latestVersion + 1, rawText: result.rawText, normalizedText: result.normalizedText, confidence: result.confidence.toFixed(4), uncertainSegments: result.uncertainSegments });
      await transaction.update(essaySubmissions).set({ status: EssaySubmissionStatus.NEEDS_REVIEW }).where(eq(essaySubmissions.id, submissionId));
      await transaction.update(aiRuns).set({ status: RunStatus.SUCCEEDED, completedAt: new Date() }).where(eq(aiRuns.id, run.id));
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na transcrição.";
    await db.transaction(async (transaction) => {
      await transaction.update(essaySubmissions).set({ status: EssaySubmissionStatus.FAILED }).where(eq(essaySubmissions.id, submissionId));
      await transaction.update(aiRuns).set({ status: RunStatus.FAILED, errorMessage: message, completedAt: new Date() }).where(eq(aiRuns.id, run.id));
    });
    throw error;
  }
}
