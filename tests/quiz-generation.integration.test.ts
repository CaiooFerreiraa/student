import { beforeAll, describe, expect, mock, test } from "bun:test";
import { eq } from "drizzle-orm";
import "@/tests/helpers/clerk";

mock.module("server-only", () => ({}));

let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let persistGeneratedQuiz: typeof import("@/lib/server/quizzes/persist-generated-quiz").persistGeneratedQuiz;
let getAttemptReview: typeof import("@/lib/server/quizzes/attempt-history").getAttemptReview;
let listAttemptHistory: typeof import("@/lib/server/quizzes/attempt-history").listAttemptHistory;
let db: typeof import("@/lib/server/db").db;
let tables: typeof import("@/lib/server/db/schema");

beforeAll(async () => {
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ persistGeneratedQuiz } = await import("@/lib/server/quizzes/persist-generated-quiz"));
  ({ getAttemptReview, listAttemptHistory } = await import("@/lib/server/quizzes/attempt-history"));
  ({ db } = await import("@/lib/server/db"));
  tables = await import("@/lib/server/db/schema");
});

describe("persistência do quiz gerado", () => {
  test("persiste questões, fontes e publica a versão atomicamente no Neon", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const [file] = await db.insert(tables.fileAssets).values({ ownerId: user.id, purpose: "MATERIAL", status: "AVAILABLE", pathname: `users/${user.id}/materials/quiz-${nonce}.txt`, url: `https://example.com/quiz-${nonce}.txt`, originalName: "quiz.txt", contentType: "text/plain", byteSize: 256 }).returning();
    if (!file) throw new Error("Fixture de arquivo não criada.");
    const [material] = await db.insert(tables.materials).values({ ownerId: user.id, fileId: file.id, title: "Fonte do quiz", type: "TEXT", processingStatus: "READY", updatedAt: new Date() }).returning();
    if (!material) throw new Error("Fixture de material não criada.");
    const [chunk] = await db.insert(tables.materialChunks).values({ materialId: material.id, position: 0, content: "Conteúdo confiável para fundamentar a questão.", contentHash: nonce, pageStart: 1, pageEnd: 1 }).returning();
    const [quiz] = await db.insert(tables.quizzes).values({ ownerId: user.id, title: "Quiz de integração", status: "GENERATING", updatedAt: new Date() }).returning();
    if (!chunk || !quiz) throw new Error("Fixtures do quiz não criadas.");
    const [version] = await db.insert(tables.quizVersions).values({ quizId: quiz.id, versionNumber: 1, status: "GENERATING", educationLevel: "UNDERGRADUATE", difficulty: "MEDIUM", mode: "STUDY", generationMode: "AI", requestedQuestionCount: 1, questionDistribution: { multipleChoice: 1, trueFalse: 0, open: 0 } }).returning();
    if (!version) throw new Error("Fixture de versão não criada.");
    const [aiRun] = await db.insert(tables.aiRuns).values({ userId: user.id, feature: "QUIZ_GENERATION", targetType: "QuizVersion", targetId: version.id, status: "RUNNING", model: "integration", promptVersion: "integration" }).returning();
    if (!aiRun) throw new Error("Fixture de execução não criada.");

    try {
      await persistGeneratedQuiz({
        quizId: quiz.id,
        versionId: version.id,
        aiRunId: aiRun.id,
        questions: [{ type: "MULTIPLE_CHOICE", statement: "Qual alternativa está fundamentada no conteúdo fornecido?", explanation: "A fonte vinculada contém o conteúdo usado na alternativa correta.", difficulty: "MEDIUM", points: 5, options: [{ content: "Alternativa correta", isCorrect: true, explanation: "Correta porque corresponde ao conteúdo da fonte." }, { content: "Alternativa incorreta", isCorrect: false, explanation: "Incorreta porque contradiz o conteúdo da fonte." }], correctBoolean: null, modelAnswer: null, gradingRubric: null, sourceKeys: ["SOURCE_1"] }],
        sources: new Map([["SOURCE_1", chunk]]),
      });

      const persisted = await db.query.quizzes.findFirst({ where: eq(tables.quizzes.id, quiz.id), with: { quizVersion: { with: { questions: { with: { questionSources: true, questionOptions: true } } } } } });
      expect(persisted?.status).toBe("READY");
      expect(persisted?.currentVersionId).toBe(version.id);
      expect(persisted?.quizVersion?.questions).toHaveLength(1);
      expect(persisted?.quizVersion?.questions[0]?.questionSources).toHaveLength(1);
      const [runStatus] = await db.select({ status: tables.aiRuns.status }).from(tables.aiRuns).where(eq(tables.aiRuns.id, aiRun.id)).limit(1);
      expect(runStatus).toEqual({ status: "SUCCEEDED" });

      const question = persisted!.quizVersion!.questions[0]!;
      const wrongOption = question.questionOptions.find((option) => !option.isCorrect)!;
      const [attempt] = await db.insert(tables.quizAttempts).values({ userId: user.id, quizId: quiz.id, quizVersionId: version.id, status: "SUBMITTED", submittedAt: new Date(), score: "0", maximumScore: "5", percentage: "0", incorrectCount: 1 }).returning();
      if (!attempt) throw new Error("Fixture de tentativa não criada.");
      await db.insert(tables.attemptAnswers).values({ attemptId: attempt.id, questionId: question.id, selectedOptionId: wrongOption.id, isCorrect: false, pointsAwarded: "0", gradingStatus: "GRADED", gradedBy: "SYSTEM" });

      const history = await listAttemptHistory(user.id, quiz.id);
      const review = await getAttemptReview(user.id, attempt.id);
      expect(history.map((item) => item.id)).toContain(attempt.id);
      expect(review?.questions[0]?.answer?.selectedOptionId).toBe(wrongOption.id);
      expect(review?.questions[0]?.options.find((option) => option.isCorrect)?.explanation).toContain("conteúdo da fonte");
      expect(review?.questions[0]?.options.find((option) => option.id === wrongOption.id)?.explanation).toContain("contradiz");
      await db.delete(tables.quizAttempts).where(eq(tables.quizAttempts.id, attempt.id));
    } finally {
      await db.delete(tables.quizAttempts).where(eq(tables.quizAttempts.quizId, quiz.id));
      await db.delete(tables.quizzes).where(eq(tables.quizzes.id, quiz.id));
      await db.delete(tables.aiRuns).where(eq(tables.aiRuns.id, aiRun.id));
      await db.delete(tables.materials).where(eq(tables.materials.id, material.id));
      await db.delete(tables.fileAssets).where(eq(tables.fileAssets.id, file.id));
    }
  });
});
