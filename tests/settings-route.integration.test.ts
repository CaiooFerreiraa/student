import { beforeAll, describe, expect, mock, test } from "bun:test";
import { and, eq, or, sql } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));
mock.module("next/server", () => ({ after: () => undefined }));

let GET: typeof import("@/app/api/settings/route").GET;
let PATCH: typeof import("@/app/api/settings/route").PATCH;
let completeMaterialUpload: typeof import("@/app/api/materials/complete/route").POST;
let listMaterials: typeof import("@/app/api/materials/route").GET;
let scheduleMaterialDeletion: typeof import("@/lib/server/materials/schedule-material-deletion").scheduleMaterialDeletion;
let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");
let registerMaterialBlob: typeof import("@/lib/server/materials/register-material-blob").registerMaterialBlob;

beforeAll(async () => {
  ({ GET, PATCH } = await import("@/app/api/settings/route"));
  ({ POST: completeMaterialUpload } = await import("@/app/api/materials/complete/route"));
  ({ GET: listMaterials } = await import("@/app/api/materials/route"));
  ({ scheduleMaterialDeletion } = await import("@/lib/server/materials/schedule-material-deletion"));
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
  ({ registerMaterialBlob } = await import("@/lib/server/materials/register-material-blob"));
});

type SettingsData = {
  displayName: string;
  bio: string;
  educationLevel: string;
  primaryGoal: string;
  weeklyStudyGoalMinutes: number;
  theme: string;
  reviewNotifications: boolean;
  weeklySummary: boolean;
  processingNotifications: boolean;
  alwaysShowSources: boolean;
  adaptToEducationLevel: boolean;
};

describe("rotas persistentes de configurações e upload", () => {
  test("lê e atualiza o perfil real pelo Route Handler", async () => {
    const initialResponse = await GET();
    const initial = await initialResponse.json() as { data: SettingsData; error: null };

    expect(initialResponse.status).toBe(200);
    expect(initial.data.displayName.length).toBeGreaterThanOrEqual(2);

    const updateResponse = await PATCH(new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...initial.data,
        bio: initial.data.bio || null,
        primaryGoal: initial.data.primaryGoal || null,
      }),
    }));
    const updated = await updateResponse.json();

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.headers.get("content-type")).toContain("application/json");
    expect(updated).toMatchObject({ data: { displayName: initial.data.displayName }, error: null });
  });

  test("upload com corpo vazio retorna erro JSON em vez de resposta vazia", async () => {
    const response = await completeMaterialUpload(new Request("http://localhost/api/materials/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ data: null, error: "O corpo da requisição não contém um JSON válido." });
  });

  test("callback e confirmação concorrentes registram somente um material", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const pathname = `users/${user.id}/materials/integration-${nonce}.pdf`;
    const input = {
      pathname,
      url: `https://example.com/${nonce}.pdf`,
      downloadUrl: `https://example.com/${nonce}.pdf?download=1`,
      contentType: "application/pdf",
      size: 1_024,
      originalName: "integration.pdf",
      subjectName: "Direito Constitucional",
    };

    try {
      const [fromCallback, fromConfirmation] = await Promise.all([
        registerMaterialBlob(user.id, input),
        registerMaterialBlob(user.id, input),
      ]);

      expect(fromCallback.id).toBe(fromConfirmation.id);
      const [counts] = await db.select({ files: sql<number>`count(distinct ${tables.fileAssets.id})::int`, materials: sql<number>`count(distinct ${tables.materials.id})::int` }).from(tables.fileAssets).leftJoin(tables.materials, eq(tables.materials.fileId, tables.fileAssets.id)).where(eq(tables.fileAssets.pathname, pathname));
      expect(counts).toEqual({ files: 1, materials: 1 });
      const [subjectCount] = await db.select({ value: sql<number>`count(*)::int` }).from(tables.subjects).where(and(eq(tables.subjects.ownerId, user.id), eq(tables.subjects.slug, "direito-constitucional")));
      const [jobCount] = await db.select({ value: sql<number>`count(*)::int` }).from(tables.backgroundJobs).where(eq(tables.backgroundJobs.idempotencyKey, `process-material:${fromCallback.id}:v1`));
      expect(subjectCount?.value).toBe(1);
      expect(jobCount?.value).toBe(1);
      const listResponse = await listMaterials();
      const listBody = await listResponse.json() as { data: Array<{ id: string; subject: string; status: string; chunkCount: number }> };
      expect(listBody.data).toContainEqual(expect.objectContaining({ id: fromCallback.id, subject: "Direito Constitucional", status: "PENDING", chunkCount: 0 }));
    } finally {
      const [row] = await db.select({ file: tables.fileAssets, material: tables.materials }).from(tables.fileAssets).leftJoin(tables.materials, eq(tables.materials.fileId, tables.fileAssets.id)).where(eq(tables.fileAssets.pathname, pathname)).limit(1);
      if (row?.material) {
        await db.delete(tables.backgroundJobs).where(and(eq(tables.backgroundJobs.targetType, "Material"), eq(tables.backgroundJobs.targetId, row.material.id)));
        await db.delete(tables.materials).where(eq(tables.materials.id, row.material.id));
      }
      if (row?.file) await db.delete(tables.fileAssets).where(eq(tables.fileAssets.id, row.file.id));
      await db.delete(tables.subjects).where(and(eq(tables.subjects.ownerId, user.id), eq(tables.subjects.slug, "direito-constitucional")));
    }
  });

  test("exclui material pendente e agenda a remoção do Blob", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const pathname = `users/${user.id}/materials/delete-${nonce}.txt`;
    const material = await registerMaterialBlob(user.id, {
      pathname,
      url: `https://example.com/${nonce}.txt`,
      contentType: "text/plain",
      size: 128,
      originalName: "delete.txt",
      subjectName: "Testes de exclusão",
    });

    try {
      const result = await scheduleMaterialDeletion(user.id, material.id);

      expect(result).toMatchObject({ status: "scheduled", material: { id: material.id } });
      const [storedMaterial] = await db.select({ deletedAt: tables.materials.deletedAt }).from(tables.materials).where(eq(tables.materials.id, material.id));
      const [storedFile] = await db.select({ status: tables.fileAssets.status }).from(tables.fileAssets).where(eq(tables.fileAssets.pathname, pathname));
      const [deleteJobs] = await db.select({ value: sql<number>`count(*)::int` }).from(tables.backgroundJobs).where(eq(tables.backgroundJobs.idempotencyKey, `delete-blob:${material.fileId}`));
      const [processJob] = await db.select({ status: tables.backgroundJobs.status }).from(tables.backgroundJobs).where(and(eq(tables.backgroundJobs.targetType, "Material"), eq(tables.backgroundJobs.targetId, material.id))).limit(1);
      expect(storedMaterial).toMatchObject({ deletedAt: expect.any(Date) });
      expect(storedFile).toEqual({ status: "DELETE_PENDING" });
      expect(deleteJobs?.value).toBe(1);
      expect(processJob).toEqual({ status: "CANCELLED" });
    } finally {
      await db.delete(tables.backgroundJobs).where(or(and(eq(tables.backgroundJobs.targetType, "Material"), eq(tables.backgroundJobs.targetId, material.id)), and(eq(tables.backgroundJobs.targetType, "FileAsset"), eq(tables.backgroundJobs.targetId, material.fileId))));
      await db.delete(tables.materials).where(eq(tables.materials.id, material.id));
      await db.delete(tables.fileAssets).where(eq(tables.fileAssets.id, material.fileId));
      await db.delete(tables.subjects).where(and(eq(tables.subjects.ownerId, user.id), eq(tables.subjects.slug, "testes-de-exclusao")));
    }
  });
});
