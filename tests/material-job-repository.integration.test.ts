import { beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");
let claimMaterialJob: typeof import("@/lib/server/materials/material-job-repository").claimMaterialJob;
let findRecoverableMaterialJobIds: typeof import("@/lib/server/materials/material-job-repository").findRecoverableMaterialJobIds;

beforeAll(async () => {
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
  ({ claimMaterialJob, findRecoverableMaterialJobIds } = await import("@/lib/server/materials/material-job-repository"));
});

describe("recuperação de processamento de materiais", () => {
  test("reivindica uma única execução e recupera um lock interrompido", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const now = new Date();
    const [file] = await db.insert(tables.fileAssets).values({
      ownerId: user.id,
      purpose: "MATERIAL",
      status: "AVAILABLE",
      pathname: `users/${user.id}/materials/job-${nonce}.pdf`,
      url: `https://example.com/job-${nonce}.pdf`,
      originalName: "job.pdf",
      contentType: "application/pdf",
      byteSize: 1_024,
    }).returning();
    if (!file) throw new Error("Fixture de arquivo não criada.");
    const [material] = await db.insert(tables.materials).values({
      ownerId: user.id,
      fileId: file.id,
      title: "Job recuperável",
      type: "PDF",
      processingStatus: "PENDING",
      updatedAt: now,
    }).returning();
    if (!material) throw new Error("Fixture de material não criada.");
    const [job] = await db.insert(tables.backgroundJobs).values({
      userId: user.id,
      kind: "PROCESS_MATERIAL",
      targetType: "Material",
      targetId: material.id,
      idempotencyKey: `process-material:${material.id}:test`,
      createdAt: new Date("2000-01-01T00:00:00.000Z"),
      updatedAt: now,
    }).returning();
    if (!job) throw new Error("Fixture de job não criada.");

    try {
      const initiallyRecoverable = await findRecoverableMaterialJobIds(user.id, now);
      expect(initiallyRecoverable).toContain(material.id);

      const claims = await Promise.all([
        claimMaterialJob(material.id, now),
        claimMaterialJob(material.id, now),
      ]);
      expect(claims.filter(Boolean)).toEqual([job.id]);

      const staleLock = new Date(now.getTime() - 120_000);
      await db.update(tables.backgroundJobs).set({ status: "RUNNING", lockedAt: staleLock, updatedAt: staleLock }).where(eq(tables.backgroundJobs.id, job.id));
      expect(await findRecoverableMaterialJobIds(user.id, now)).toContain(material.id);
      expect(await claimMaterialJob(material.id, now)).toBe(job.id);

      const [storedJob] = await db.select({ attempts: tables.backgroundJobs.attempts, lockedAt: tables.backgroundJobs.lockedAt }).from(tables.backgroundJobs).where(eq(tables.backgroundJobs.id, job.id));
      expect(storedJob).toEqual({ attempts: 2, lockedAt: now });
      await expect(findRecoverableMaterialJobIds(user.id, now)).resolves.not.toContain(material.id);
    } finally {
      await db.delete(tables.backgroundJobs).where(eq(tables.backgroundJobs.id, job.id));
      await db.delete(tables.materials).where(eq(tables.materials.id, material.id));
      await db.delete(tables.fileAssets).where(eq(tables.fileAssets.id, file.id));
    }
  });
});
