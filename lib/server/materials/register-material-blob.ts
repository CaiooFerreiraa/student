import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { FilePurpose, FileStatus, MaterialType, ProcessingStatus, type MaterialType as MaterialTypeValue } from "@/domain/enums";
import { db } from "@/lib/server/db";
import { isUniqueViolation } from "@/lib/server/db/errors";
import { backgroundJobs, fileAssets, materials } from "@/lib/server/db/schema";
import { resolveOwnedSubject } from "@/lib/server/subjects/resolve-subject";

const blobSchema = z.object({ pathname: z.string().min(1), url: z.string().url(), downloadUrl: z.string().url().optional(), contentType: z.string().min(1), size: z.number().int().nonnegative(), originalName: z.string().min(1).max(255), subjectName: z.string().trim().min(2).max(100).optional() });
export type CompletedMaterialBlob = z.infer<typeof blobSchema>;

function materialType(contentType: string, filename: string): MaterialTypeValue {
  if (contentType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return MaterialType.PDF;
  if (contentType.includes("wordprocessingml") || filename.toLowerCase().endsWith(".docx")) return MaterialType.DOCX;
  if (contentType.startsWith("image/")) return MaterialType.IMAGE;
  return MaterialType.TEXT;
}

export async function registerMaterialBlob(userId: string, input: CompletedMaterialBlob): Promise<typeof materials.$inferSelect> {
  const blob = blobSchema.parse(input);
  if (!blob.pathname.startsWith(`users/${userId}/materials/`)) throw new Error("O arquivo não pertence ao usuário atual.");
  const subjectId = blob.subjectName ? await resolveOwnedSubject(userId, blob.subjectName) : null;

  try {
    return await db.transaction(async (transaction) => {
      const [file] = await transaction.insert(fileAssets).values({ ownerId: userId, purpose: FilePurpose.MATERIAL, status: FileStatus.AVAILABLE, pathname: blob.pathname, url: blob.url, downloadUrl: blob.downloadUrl, originalName: blob.originalName, contentType: blob.contentType, byteSize: blob.size }).returning();
      if (!file) throw new Error("Não foi possível registrar o arquivo.");
      const now = new Date();
      const [material] = await transaction.insert(materials).values({ ownerId: userId, fileId: file.id, subjectId, title: blob.originalName.replace(/\.[^.]+$/, ""), type: materialType(blob.contentType, blob.originalName), processingStatus: ProcessingStatus.PENDING, updatedAt: now }).returning();
      if (!material) throw new Error("Não foi possível registrar o material.");
      await transaction.insert(backgroundJobs).values({ userId, kind: "PROCESS_MATERIAL", targetType: "Material", targetId: material.id, idempotencyKey: `process-material:${material.id}:v1`, updatedAt: now });
      return material;
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [existing] = await db.select({ file: fileAssets, material: materials }).from(fileAssets).innerJoin(materials, eq(materials.fileId, fileAssets.id)).where(eq(fileAssets.pathname, blob.pathname)).limit(1);
    if (!existing || existing.file.ownerId !== userId || existing.file.purpose !== FilePurpose.MATERIAL || existing.material.ownerId !== userId) throw error;
    if (subjectId && !existing.material.subjectId) {
      const [updated] = await db.update(materials).set({ subjectId, updatedAt: new Date() }).where(eq(materials.id, existing.material.id)).returning();
      if (!updated) throw new Error("Não foi possível associar a matéria.");
      return updated;
    }
    if (subjectId && existing.material.subjectId !== subjectId) throw new Error("O material já está associado a outra matéria.");
    return existing.material;
  }
}
