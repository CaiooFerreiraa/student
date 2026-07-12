import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { FilePurpose, FileStatus } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { isUniqueViolation } from "@/lib/server/db/errors";
import { essaySubmissionFiles, essaySubmissions, fileAssets } from "@/lib/server/db/schema";

const schema = z.object({ submissionId: z.string().uuid(), pathname: z.string().min(1), url: z.string().url(), downloadUrl: z.string().url().optional(), contentType: z.string().min(1), size: z.number().int().nonnegative(), originalName: z.string().min(1).max(255), position: z.number().int().min(0) });

export async function registerEssayBlob(userId: string, raw: z.infer<typeof schema>): Promise<typeof fileAssets.$inferSelect> {
  const input = schema.parse(raw);
  const [submission] = await db.select().from(essaySubmissions).where(and(eq(essaySubmissions.id, input.submissionId), eq(essaySubmissions.userId, userId))).limit(1);
  if (!submission) throw new Error("Submissão não encontrada.");
  if (!input.pathname.startsWith(`users/${userId}/essays/${submission.id}/`)) throw new Error("Pathname inválido.");
  try {
    return await db.transaction(async (transaction) => {
      const [file] = await transaction.insert(fileAssets).values({ ownerId: userId, purpose: FilePurpose.ESSAY_SUBMISSION, status: FileStatus.AVAILABLE, pathname: input.pathname, url: input.url, downloadUrl: input.downloadUrl, originalName: input.originalName, contentType: input.contentType, byteSize: input.size }).returning();
      if (!file) throw new Error("Não foi possível registrar o arquivo.");
      await transaction.insert(essaySubmissionFiles).values({ submissionId: submission.id, fileId: file.id, position: input.position, pageNumber: input.position + 1 });
      return file;
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [existing] = await db.select({ file: fileAssets, link: essaySubmissionFiles }).from(fileAssets).innerJoin(essaySubmissionFiles, eq(essaySubmissionFiles.fileId, fileAssets.id))
      .where(and(eq(fileAssets.pathname, input.pathname), eq(essaySubmissionFiles.submissionId, submission.id))).limit(1);
    if (!existing || existing.file.ownerId !== userId || existing.file.purpose !== FilePurpose.ESSAY_SUBMISSION || existing.link.position !== input.position) throw error;
    return existing.file;
  }
}
