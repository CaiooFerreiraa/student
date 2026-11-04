import { beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let GET: typeof import("@/app/api/attempts/[id]/answers/route").GET;
let PUT: typeof import("@/app/api/attempts/[id]/answers/route").PUT;
let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");

beforeAll(async () => {
  ({ GET, PUT } = await import("@/app/api/attempts/[id]/answers/route"));
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
});

describe("confirmação de resposta", () => {
  test("corrige, restaura, aceita repetição idêntica e rejeita alteração", async () => {
    const user = await getCurrentUser();
    const [quiz] = await db.insert(tables.quizzes).values({ ownerId: user.id, title: "Confirmação", status: "READY", updatedAt: new Date() }).returning();
    if (!quiz) throw new Error("Quiz não criado.");
    try {
      const [version] = await db.insert(tables.quizVersions).values({
        quizId: quiz.id, versionNumber: 1, status: "READY", educationLevel: "HIGH_SCHOOL",
        difficulty: "MEDIUM", mode: "STUDY", generationMode: "AI", answerRevealMode: "AFTER_QUESTION", requestedQuestionCount: 3,
      }).returning();
      if (!version) throw new Error("Versão não criada.");
      const [question] = await db.insert(tables.questions).values({
        quizVersionId: version.id, position: 1, type: "MULTIPLE_CHOICE", statement: "Qual é a correta?",
        difficulty: "MEDIUM", explanation: "A primeira alternativa está correta.",
      }).returning();
      if (!question) throw new Error("Questão não criada.");
      const options = await db.insert(tables.questionOptions).values([
        { questionId: question.id, position: 1, content: "Correta", isCorrect: true, explanation: "Porque sim." },
        { questionId: question.id, position: 2, content: "Incorreta", isCorrect: false, explanation: "Porque não." },
      ]).returning();
      const [openQuestion] = await db.insert(tables.questions).values({
        quizVersionId: version.id, position: 2, type: "OPEN", statement: "Justifique.",
        difficulty: "MEDIUM", modelAnswer: "Resposta-modelo sigilosa.",
        explanation: "Resolução sigilosa.",
      }).returning();
      if (!openQuestion) throw new Error("Questão aberta não criada.");
      const [legacyQuestion] = await db.insert(tables.questions).values({
        quizVersionId: version.id, position: 3, type: "TRUE_FALSE", statement: "É verdadeiro?",
        difficulty: "MEDIUM", correctBoolean: true, explanation: "Sim.",
      }).returning();
      if (!legacyQuestion) throw new Error("Questão legada não criada.");
      const [attempt] = await db.insert(tables.quizAttempts).values({ userId: user.id, quizId: quiz.id, quizVersionId: version.id }).returning();
      if (!attempt || options.length !== 2) throw new Error("Tentativa não criada.");
      const context = { params: Promise.resolve({ id: attempt.id }) };
      const send = (selectedOptionId: string) => PUT(new Request("http://localhost/api/attempts/answers", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedOptionId }),
      }), context);

      const first = await send(options[1]!.id);
      expect(first.status).toBe(200);
      const payload = await first.json();
      expect(payload.data).toMatchObject({ isCorrect: false, gradingStatus: "GRADED", resolution: { correctOptionId: options[0]!.id, explanation: "A primeira alternativa está correta." } });
      expect((await (await send(options[1]!.id)).json()).data.selectedOptionId).toBe(options[1]!.id);
      expect((await send(options[0]!.id)).status).toBe(409);
      const restored = await GET(new Request("http://localhost/api/attempts/answers"), context);
      expect((await restored.json()).data.confirmed).toHaveLength(1);
      const [stored] = await db.select().from(tables.attemptAnswers).where(eq(tables.attemptAnswers.attemptId, attempt.id));
      expect(stored?.selectedOptionId).toBe(options[1]!.id);
      expect(stored?.isCorrect).toBe(false);
      const openResponse = await PUT(new Request("http://localhost/api/attempts/answers", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: openQuestion.id, textAnswer: "Minha justificativa." }),
      }), context);
      expect((await openResponse.json()).data).toMatchObject({ gradingStatus: "PENDING", resolution: null, isCorrect: null });
      await db.insert(tables.attemptAnswers).values({ attemptId: attempt.id, questionId: legacyQuestion.id, booleanAnswer: false, gradingStatus: "NOT_REQUIRED" });
      const resumed = (await (await GET(new Request("http://localhost/api/attempts/answers"), context)).json()).data;
      expect(resumed.confirmed).toHaveLength(2);
      expect(resumed.drafts).toEqual([{ questionId: legacyQuestion.id, selectedOptionId: null, booleanAnswer: false, textAnswer: null }]);
      const legacyResponse = await PUT(new Request("http://localhost/api/attempts/answers", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId: legacyQuestion.id, booleanAnswer: true }),
      }), context);
      expect((await legacyResponse.json()).data).toMatchObject({ isCorrect: true, resolution: { correctBoolean: true } });
      expect((await (await GET(new Request("http://localhost/api/attempts/answers"), context)).json()).data.confirmed).toHaveLength(3);

      await db.update(tables.quizVersions).set({ answerRevealMode: "AFTER_SUBMIT" }).where(eq(tables.quizVersions.id, version.id));
      const hidden = (await (await GET(new Request("http://localhost/api/attempts/answers"), context)).json()).data.confirmed;
      expect(hidden[0]).toMatchObject({ isCorrect: null, resolution: null });
      expect((await (await send(options[1]!.id)).json()).data.resolution).toBeNull();
      await db.update(tables.quizVersions).set({ answerRevealMode: "NEVER" }).where(eq(tables.quizVersions.id, version.id));
      expect((await (await GET(new Request("http://localhost/api/attempts/answers"), context)).json()).data.confirmed[0].resolution).toBeNull();
    } finally {
      await db.delete(tables.quizAttempts).where(eq(tables.quizAttempts.quizId, quiz.id));
      await db.delete(tables.quizzes).where(eq(tables.quizzes.id, quiz.id));
    }
  });
});
