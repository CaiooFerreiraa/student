import { beforeAll, describe, expect, mock, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let GET: typeof import("@/app/api/subjects/route").GET;
let POST: typeof import("@/app/api/subjects/route").POST;
let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let db: typeof import("@/lib/server/db").db;
let subjects: typeof import("@/lib/server/db/schema").subjects;

beforeAll(async () => {
  ({ GET, POST } = await import("@/app/api/subjects/route"));
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ db } = await import("@/lib/server/db"));
  ({ subjects } = await import("@/lib/server/db/schema"));
});

describe("subjects route", () => {
  test("creates an owned subject idempotently and lists it", async () => {
    const user = await getCurrentUser();
    const name = `Matéria integração ${crypto.randomUUID()}`;
    let subjectId: string | null = null;

    try {
      const create = () => POST(new Request("http://localhost/api/subjects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      }));
      const firstResponse = await create();
      const first = await firstResponse.json() as { data: { id: string; name: string }; error: null };
      const secondResponse = await create();
      const second = await secondResponse.json() as { data: { id: string; name: string }; error: null };
      subjectId = first.data.id;

      expect(firstResponse.status).toBe(201);
      expect(second.data.id).toBe(first.data.id);
      expect(first.data.name).toBe(name);

      const listResponse = await GET();
      const list = await listResponse.json() as { data: Array<{ id: string; name: string }>; error: null };
      expect(list.data).toContainEqual(expect.objectContaining({ id: subjectId, name }));
    } finally {
      if (subjectId) {
        await db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.ownerId, user.id)));
      }
    }
  });
});
