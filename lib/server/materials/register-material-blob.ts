import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { FilePurpose, FileStatus, MaterialType, ProcessingStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/server/prisma";
import { resolveOwnedSubject } from "@/lib/server/subjects/resolve-subject";

const blobSchema = z.object({
  pathname: z.string().min(1),
  url: z.string().url(),
  downloadUrl: z.string().url().optional(),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  originalName: z.string().min(1).max(255),
  subjectName: z.string().trim().min(2).max(100).optional(),
});

export type CompletedMaterialBlob = z.infer<typeof blobSchema>;

function materialType(contentType: string, filename: string): MaterialType {
  if (contentType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return MaterialType.PDF;
  if (contentType.includes("wordprocessingml") || filename.toLowerCase().endsWith(".docx")) return MaterialType.DOCX;
  if (contentType.startsWith("image/")) return MaterialType.IMAGE;
  return MaterialType.TEXT;
}

export async function registerMaterialBlob(userId: string, input: CompletedMaterialBlob) {
  const blob = blobSchema.parse(input);
  if (!blob.pathname.startsWith(`users/${userId}/materials/`)) {
    throw new Error("O arquivo não pertence ao usuário atual.");
  }
  const subjectId = blob.subjectName ? await resolveOwnedSubject(userId, blob.subjectName) : null;

  try {
    return await prisma.$transaction(async (tx) => {
      const file = await tx.fileAsset.create({
        data: {
          ownerId: userId,
          purpose: FilePurpose.MATERIAL,
          status: FileStatus.AVAILABLE,
          pathname: blob.pathname,
          url: blob.url,
          downloadUrl: blob.downloadUrl,
          originalName: blob.originalName,
          contentType: blob.contentType,
          byteSize: BigInt(blob.size),
        },
      });

      const material = await tx.material.create({
        data: {
          ownerId: userId,
          fileId: file.id,
          subjectId,
          title: blob.originalName.replace(/\.[^.]+$/, ""),
          type: materialType(blob.contentType, blob.originalName),
          processingStatus: ProcessingStatus.PENDING,
        },
      });

      await tx.backgroundJob.create({
        data: {
          userId,
          kind: "PROCESS_MATERIAL",
          targetType: "Material",
          targetId: material.id,
          idempotencyKey: `process-material:${material.id}:v1`,
        },
      });
      return material;
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;

    const existing = await prisma.fileAsset.findUnique({
      where: { pathname: blob.pathname },
      include: { material: true },
    });

    if (
      !existing?.material
      || existing.ownerId !== userId
      || existing.purpose !== FilePurpose.MATERIAL
      || existing.material.ownerId !== userId
    ) {
      throw error;
    }

    if (subjectId && !existing.material.subjectId) {
      return prisma.material.update({ where: { id: existing.material.id }, data: { subjectId } });
    }

    if (subjectId && existing.material.subjectId !== subjectId) {
      throw new Error("O material já está associado a outra matéria.");
    }

    return existing.material;
  }
}
