import { beforeAll, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

let getCurrentUser: typeof import("@/lib/server/current-user").getCurrentUser;
let persistGeneratedQuiz: typeof import("@/lib/server/quizzes/persist-generated-quiz").persistGeneratedQuiz;
let getAttemptReview: typeof import("@/lib/server/quizzes/attempt-history").getAttemptReview;
let listAttemptHistory: typeof import("@/lib/server/quizzes/attempt-history").listAttemptHistory;
let prisma: typeof import("@/lib/server/prisma").prisma;

beforeAll(async () => {
  ({ getCurrentUser } = await import("@/lib/server/current-user"));
  ({ persistGeneratedQuiz } =
    await import("@/lib/server/quizzes/persist-generated-quiz"));
  ({ getAttemptReview, listAttemptHistory } =
    await import("@/lib/server/quizzes/attempt-history"));
  ({ prisma } = await import("@/lib/server/prisma"));
});

describe("persistência do quiz gerado", () => {
  test("persiste questões, fontes e publica a versão atomicamente no Neon", async () => {
    const user = await getCurrentUser();
    const nonce = crypto.randomUUID();
    const file = await prisma.fileAsset.create({
      data: {
        ownerId: user.id,
        purpose: "MATERIAL",
        status: "AVAILABLE",
        pathname: `users/${user.id}/materials/quiz-${nonce}.txt`,
        url: `https://example.com/quiz-${nonce}.txt`,
        originalName: "quiz.txt",
        contentType: "text/plain",
        byteSize: BigInt(256),
      },
    });
    const material = await prisma.material.create({
      data: {
        ownerId: user.id,
        fileId: file.id,
        title: "Fonte do quiz",
        type: "TEXT",
        processingStatus: "READY",
      },
    });
    const chunk = await prisma.materialChunk.create({
      data: {
        materialId: material.id,
        position: 0,
        content: "Conteúdo confiável para fundamentar a questão.",
        contentHash: nonce,
        pageStart: 1,
        pageEnd: 1,
      },
    });
    const quiz = await prisma.quiz.create({
      data: {
        ownerId: user.id,
        title: "Quiz de integração",
        status: "GENERATING",
        versions: {
          create: {
            versionNumber: 1,
            status: "GENERATING",
            educationLevel: "UNDERGRADUATE",
            difficulty: "MEDIUM",
            mode: "STUDY",
            generationMode: "AI",
            requestedQuestionCount: 1,
            questionDistribution: { multipleChoice: 1, trueFalse: 0, open: 0 },
          },
        },
      },
      include: { versions: true },
    });
    const version = quiz.versions[0]!;
    const aiRun = await prisma.aiRun.create({
      data: {
        userId: user.id,
        feature: "QUIZ_GENERATION",
        targetType: "QuizVersion",
        targetId: version.id,
        status: "RUNNING",
        model: "integration",
        promptVersion: "integration",
      },
    });

    try {
      await persistGeneratedQuiz({
        quizId: quiz.id,
        versionId: version.id,
        aiRunId: aiRun.id,
        questions: [
          {
            type: "MULTIPLE_CHOICE",
            statement:
              "Qual alternativa está fundamentada no conteúdo fornecido?",
            explanation:
              "A fonte vinculada contém o conteúdo usado na alternativa correta.",
            difficulty: "MEDIUM",
            points: 5,
            options: [
              {
                content: "Alternativa correta",
                isCorrect: true,
                explanation: "Correta porque corresponde ao conteúdo da fonte.",
              },
              {
                content: "Alternativa incorreta",
                isCorrect: false,
                explanation: "Incorreta porque contradiz o conteúdo da fonte.",
              },
            ],
            correctBoolean: null,
            modelAnswer: null,
            gradingRubric: null,
            sourceKeys: ["SOURCE_1"],
          },
        ],
        sources: new Map([["SOURCE_1", chunk]]),
      });

      const persisted = await prisma.quiz.findUniqueOrThrow({
        where: { id: quiz.id },
        include: {
          currentVersion: {
            include: {
              questions: { include: { sources: true, options: true } },
            },
          },
        },
      });
      expect(persisted.status).toBe("READY");
      expect(persisted.currentVersionId).toBe(version.id);
      expect(persisted.currentVersion?.questions).toHaveLength(1);
      expect(persisted.currentVersion?.questions[0]?.sources).toHaveLength(1);
      expect(
        await prisma.aiRun.findUnique({
          where: { id: aiRun.id },
          select: { status: true },
        }),
      ).toEqual({ status: "SUCCEEDED" });

      const question = persisted.currentVersion!.questions[0]!;
      const wrongOption = question.options.find((option) => !option.isCorrect)!;
      const attempt = await prisma.quizAttempt.create({
        data: {
          userId: user.id,
          quizId: quiz.id,
          quizVersionId: version.id,
          status: "SUBMITTED",
          submittedAt: new Date(),
          score: 0,
          maximumScore: 5,
          percentage: 0,
          incorrectCount: 1,
          answers: {
            create: {
              questionId: question.id,
              selectedOptionId: wrongOption.id,
              isCorrect: false,
              pointsAwarded: 0,
              gradingStatus: "GRADED",
              gradedBy: "SYSTEM",
            },
          },
        },
      });

      const history = await listAttemptHistory(user.id, quiz.id);
      const review = await getAttemptReview(user.id, attempt.id);
      expect(history.map((item) => item.id)).toContain(attempt.id);
      expect(review?.questions[0]?.answer?.selectedOptionId).toBe(
        wrongOption.id,
      );
      expect(
        review?.questions[0]?.options.find((option) => option.isCorrect)
          ?.explanation,
      ).toContain("conteúdo da fonte");
      expect(
        review?.questions[0]?.options.find(
          (option) => option.id === wrongOption.id,
        )?.explanation,
      ).toContain("contradiz");

      await prisma.quizAttempt.delete({ where: { id: attempt.id } });
    } finally {
      await prisma.quizAttempt.deleteMany({ where: { quizId: quiz.id } });
      await prisma.quiz.delete({ where: { id: quiz.id } });
      await prisma.aiRun.delete({ where: { id: aiRun.id } });
      await prisma.material.delete({ where: { id: material.id } });
      await prisma.fileAsset.delete({ where: { id: file.id } });
    }
  });
});
