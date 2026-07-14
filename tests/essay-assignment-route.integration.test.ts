import { beforeAll, describe, expect, mock, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { EssayType } from "@/domain/enums";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let POST: typeof import("@/app/api/essays/assignments/route").POST;
let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");

beforeAll(async () => {
  ({ POST } = await import("@/app/api/essays/assignments/route"));
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
});

describe("essay assignments route", () => {
  test("creates a proposal owned by the current user", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const [rubric] = await db.insert(tables.essayRubrics).values({
      ownerId: user.id,
      name: `Rubrica integração ${nonce}`,
      version: 1,
      essayType: EssayType.ENEM,
      maximumScore: 1_000,
      isActive: true,
    }).returning();
    if (!rubric) throw new Error("Não foi possível preparar a rubrica do teste.");
    let assignmentId: string | null = null;

    try {
      const response = await POST(new Request("http://localhost/api/essays/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Proposta ${nonce}`,
          prompt: "Discuta os impactos sociais do acesso desigual à educação digital no Brasil.",
          essayType: EssayType.ENEM,
          rubricId: rubric.id,
        }),
      }));
      const result = await response.json() as { data: { id: string; ownerId: string; title: string }; error: null };
      assignmentId = result.data.id;

      expect(response.status).toBe(201);
      expect(result.data.ownerId).toBe(user.id);
      expect(result.data.title).toBe(`Proposta ${nonce}`);
    } finally {
      if (assignmentId) {
        await db.delete(tables.essayAssignments).where(and(eq(tables.essayAssignments.id, assignmentId), eq(tables.essayAssignments.ownerId, user.id)));
      }
      await db.delete(tables.essayRubrics).where(eq(tables.essayRubrics.id, rubric.id));
    }
  });
});
