import "server-only";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { backgroundJobs, materials } from "@/lib/server/db/schema";

const STALE_JOB_AFTER_MS = 60_000;
const RECOVERY_BATCH_SIZE = 2;

function staleBefore(now: Date): Date {
  return new Date(now.getTime() - STALE_JOB_AFTER_MS);
}

export async function claimMaterialJob(materialId: string, now = new Date()): Promise<string | null> {
  const [job] = await db.update(backgroundJobs).set({
    status: "RUNNING",
    attempts: sql`${backgroundJobs.attempts} + 1`,
    lockedAt: now,
    updatedAt: now,
  }).where(and(
    eq(backgroundJobs.targetType, "Material"),
    eq(backgroundJobs.targetId, materialId),
    eq(backgroundJobs.kind, "PROCESS_MATERIAL"),
    or(
      eq(backgroundJobs.status, "PENDING"),
      and(eq(backgroundJobs.status, "RUNNING"), lt(backgroundJobs.lockedAt, staleBefore(now))),
    ),
  )).returning({ id: backgroundJobs.id });

  return job?.id ?? null;
}

export async function findRecoverableMaterialJobIds(
  userId: string,
  now = new Date(),
): Promise<string[]> {
  const rows = await db
    .select({ materialId: materials.id })
    .from(backgroundJobs)
    .innerJoin(materials, eq(materials.id, backgroundJobs.targetId))
    .where(and(
      eq(materials.ownerId, userId),
      isNull(materials.deletedAt),
      eq(backgroundJobs.kind, "PROCESS_MATERIAL"),
      eq(backgroundJobs.targetType, "Material"),
      or(
        eq(backgroundJobs.status, "PENDING"),
        and(eq(backgroundJobs.status, "RUNNING"), lt(backgroundJobs.lockedAt, staleBefore(now))),
      ),
    ))
    .orderBy(asc(backgroundJobs.createdAt))
    .limit(RECOVERY_BATCH_SIZE);

  return rows.map((row) => row.materialId);
}
