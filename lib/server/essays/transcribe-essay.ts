import "server-only";
import { get } from "@vercel/blob";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { AiFeature, EssayInputType, EssaySubmissionStatus, RunStatus } from "@/generated/prisma/enums";
import { getAiEnv, getBlobEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

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
  const submission = await prisma.essaySubmission.findFirst({
    where: { id: submissionId, userId },
    include: { files: { orderBy: { position: "asc" }, include: { file: true } }, transcriptions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!submission) throw new Error("Submissão não encontrada.");
  await prisma.essaySubmission.update({ where: { id: submissionId }, data: { status: EssaySubmissionStatus.EXTRACTING } });

  if (submission.inputType === EssayInputType.TEXT) {
    const text = submission.originalText?.trim();
    if (!text) throw new Error("A redação não possui texto.");
    await prisma.$transaction([
      prisma.essayTranscription.create({ data: { submissionId, versionNumber: (submission.transcriptions[0]?.versionNumber ?? 0) + 1, rawText: text, normalizedText: text, confidence: 1, confirmedByUserAt: new Date() } }),
      prisma.essaySubmission.update({ where: { id: submissionId }, data: { confirmedText: text, confirmedAt: new Date(), status: EssaySubmissionStatus.READY_TO_GRADE } }),
    ]);
    return;
  }

  if (submission.files.length === 0) throw new Error("Nenhum arquivo foi enviado.");

  if (submission.inputType === EssayInputType.DOCX) {
    const source = await privateBlob(submission.files[0]!.file.pathname);
    const documents = await new DocxLoader(new Blob([source.bytes], { type: source.contentType }), { type: "docx" }).load();
    const text = documents.map((document) => document.pageContent).join("\n\n").trim();
    if (!text) throw new Error("Não foi possível extrair texto do DOCX.");
    await prisma.$transaction([
      prisma.essayTranscription.create({ data: { submissionId, versionNumber: (submission.transcriptions[0]?.versionNumber ?? 0) + 1, rawText: text, normalizedText: text, confidence: 1 } }),
      prisma.essaySubmission.update({ where: { id: submissionId }, data: { status: EssaySubmissionStatus.NEEDS_REVIEW } }),
    ]);
    return;
  }

  const aiEnv = getAiEnv();
  const run = await prisma.aiRun.create({ data: { userId, feature: AiFeature.ESSAY_TRANSCRIPTION, targetType: "EssaySubmission", targetId: submissionId, status: RunStatus.RUNNING, model: aiEnv.OPENAI_CHAT_MODEL, promptVersion: ESSAY_TRANSCRIPTION_PROMPT_VERSION } });
  try {
    const imageParts: Array<{ type: "image_url"; image_url: { url: string; detail: "high" } }> = [];
    for (const entry of submission.files) {
      const source = await privateBlob(entry.file.pathname);
      const base64 = Buffer.from(source.bytes).toString("base64");
      imageParts.push({ type: "image_url", image_url: { url: `data:${source.contentType};base64,${base64}`, detail: "high" } });
    }
    const model = new ChatOpenAI({ apiKey: aiEnv.OPENAI_API_KEY, model: aiEnv.OPENAI_CHAT_MODEL });
    const structured = model.withStructuredOutput(transcriptionSchema, { name: "essay_transcription" });
    const result = await structured.invoke([
      new SystemMessage("Transcreva fielmente a redação manuscrita. Preserve parágrafos, grafia e pontuação originais. Não corrija o texto. Marque trechos incertos e retorne confiança de 0 a 1."),
      new HumanMessage({ content: [{ type: "text", text: "As imagens estão em ordem. Transcreva todo o texto." }, ...imageParts] }),
    ]);
    await prisma.$transaction([
      prisma.essayTranscription.create({ data: { submissionId, versionNumber: (submission.transcriptions[0]?.versionNumber ?? 0) + 1, rawText: result.rawText, normalizedText: result.normalizedText, confidence: result.confidence, uncertainSegments: result.uncertainSegments } }),
      prisma.essaySubmission.update({ where: { id: submissionId }, data: { status: EssaySubmissionStatus.NEEDS_REVIEW } }),
      prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.SUCCEEDED, completedAt: new Date() } }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na transcrição.";
    await prisma.$transaction([
      prisma.essaySubmission.update({ where: { id: submissionId }, data: { status: EssaySubmissionStatus.FAILED } }),
      prisma.aiRun.update({ where: { id: run.id }, data: { status: RunStatus.FAILED, errorMessage: message, completedAt: new Date() } }),
    ]);
    throw error;
  }
}
