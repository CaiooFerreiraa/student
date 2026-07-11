import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { FilePurpose, FileStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/server/prisma";

const schema = z.object({
  submissionId: z.string().uuid(),
  pathname: z.string().min(1),
  url: z.string().url(),
  downloadUrl: z.string().url().optional(),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  originalName: z.string().min(1).max(255),
  position: z.number().int().min(0),
});

export async function registerEssayBlob(userId: string, raw: z.infer<typeof schema>) {
  const input = schema.parse(raw);
  const submission = await prisma.essaySubmission.findFirst({ where: { id: input.submissionId, userId } });
  if (!submission) throw new Error("Submissão não encontrada.");
  if (!input.pathname.startsWith(`users/${userId}/essays/${submission.id}/`)) throw new Error("Pathname inválido.");

  try {
    return await prisma.$transaction(async (tx) => {
      const file = await tx.fileAsset.create({
        data: {
          ownerId: userId,
          purpose: FilePurpose.ESSAY_SUBMISSION,
          status: FileStatus.AVAILABLE,
          pathname: input.pathname,
          url: input.url,
          downloadUrl: input.downloadUrl,
          originalName: input.originalName,
          contentType: input.contentType,
          byteSize: BigInt(input.size),
        },
      });
      await tx.essaySubmissionFile.create({ data: { submissionId: submission.id, fileId: file.id, position: input.position, pageNumber: input.position + 1 } });
      return file;
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

    const existing = await prisma.fileAsset.findUnique({
      where: { pathname: input.pathname },
      include: { essayFiles: { where: { submissionId: submission.id } } },
    });

    if (
      !existing
      || existing.ownerId !== userId
      || existing.purpose !== FilePurpose.ESSAY_SUBMISSION
      || existing.essayFiles.length !== 1
      || existing.essayFiles[0]?.position !== input.position
    ) {
      throw error;
    }

    return existing;
  }
}
