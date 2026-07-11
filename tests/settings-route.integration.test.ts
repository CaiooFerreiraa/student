import { beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let GET: typeof import("@/app/api/settings/route").GET;
let PATCH: typeof import("@/app/api/settings/route").PATCH;
let completeMaterialUpload: typeof import("@/app/api/materials/complete/route").POST;
let listMaterials: typeof import("@/app/api/materials/route").GET;
let scheduleMaterialDeletion: typeof import("@/lib/server/materials/schedule-material-deletion").scheduleMaterialDeletion;
let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let prisma: typeof import("@/lib/server/prisma").prisma;
let registerMaterialBlob: typeof import("@/lib/server/materials/register-material-blob").registerMaterialBlob;

beforeAll(async () => {
  ({ GET, PATCH } = await import("@/app/api/settings/route"));
  ({ POST: completeMaterialUpload } = await import("@/app/api/materials/complete/route"));
  ({ GET: listMaterials } = await import("@/app/api/materials/route"));
  ({ scheduleMaterialDeletion } = await import("@/lib/server/materials/schedule-material-deletion"));
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ prisma } = await import("@/lib/server/prisma"));
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
      expect(await prisma.fileAsset.count({ where: { pathname } })).toBe(1);
      expect(await prisma.material.count({ where: { file: { pathname } } })).toBe(1);
      expect(await prisma.material.count({ where: { file: { pathname }, subject: { name: "Direito Constitucional" } } })).toBe(1);
      expect(await prisma.subject.count({ where: { ownerId: user.id, slug: "direito-constitucional" } })).toBe(1);
      expect(await prisma.backgroundJob.count({ where: { idempotencyKey: `process-material:${fromCallback.id}:v1` } })).toBe(1);
      const listResponse = await listMaterials();
      const listBody = await listResponse.json() as { data: Array<{ id: string; subject: string; status: string; chunkCount: number }> };
      expect(listBody.data).toContainEqual(expect.objectContaining({ id: fromCallback.id, subject: "Direito Constitucional", status: "PENDING", chunkCount: 0 }));
    } finally {
      const file = await prisma.fileAsset.findUnique({ where: { pathname }, include: { material: true } });
      if (file?.material) {
        await prisma.backgroundJob.deleteMany({ where: { targetType: "Material", targetId: file.material.id } });
        await prisma.material.delete({ where: { id: file.material.id } });
      }
      if (file) await prisma.fileAsset.delete({ where: { id: file.id } });
      await prisma.subject.deleteMany({ where: { ownerId: user.id, slug: "direito-constitucional", materials: { none: {} } } });
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
      expect(await prisma.material.findUnique({ where: { id: material.id }, select: { deletedAt: true } })).toMatchObject({ deletedAt: expect.any(Date) });
      expect(await prisma.fileAsset.findUnique({ where: { pathname }, select: { status: true } })).toEqual({ status: "DELETE_PENDING" });
      expect(await prisma.backgroundJob.count({ where: { idempotencyKey: `delete-blob:${material.fileId}` } })).toBe(1);
      expect(await prisma.backgroundJob.findFirst({ where: { targetType: "Material", targetId: material.id }, select: { status: true } })).toEqual({ status: "CANCELLED" });
    } finally {
      await prisma.backgroundJob.deleteMany({ where: { OR: [{ targetType: "Material", targetId: material.id }, { targetType: "FileAsset", targetId: material.fileId }] } });
      await prisma.material.deleteMany({ where: { id: material.id } });
      await prisma.fileAsset.deleteMany({ where: { id: material.fileId } });
      await prisma.subject.deleteMany({ where: { ownerId: user.id, slug: "testes-de-exclusao", materials: { none: {} } } });
    }
  });
});
