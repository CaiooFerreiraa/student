import "server-only";
import { createQuizSchema, type CreateQuizInput } from "@/domain/quiz/quiz-config";
import { prisma } from "@/lib/server/prisma";

export async function createQuiz(userId: string, raw: CreateQuizInput) {
  const input = createQuizSchema.parse(raw);
  if (input.subjectId) {
    const subject = await prisma.subject.findFirst({ where: { id: input.subjectId, OR: [{ ownerId: userId }, { ownerId: null }] } });
    if (!subject) throw new Error("Disciplina inválida.");
  }
  if (input.materialIds.length) {
    const count = await prisma.material.count({ where: { id: { in: input.materialIds }, ownerId: userId, deletedAt: null, processingStatus: "READY" } });
    if (count !== input.materialIds.length) throw new Error("Um ou mais materiais não estão prontos ou não pertencem ao usuário.");
  }
  const total = input.questionDistribution.multipleChoice + input.questionDistribution.trueFalse + input.questionDistribution.open;
  return prisma.quiz.create({
    data: {
      ownerId: userId,
      subjectId: input.subjectId,
      title: input.title,
      description: input.description,
      status: "DRAFT",
      versions: {
        create: {
          versionNumber: 1,
          educationLevel: input.educationLevel,
          difficulty: input.difficulty,
          mode: input.mode,
          generationMode: input.generationMode,
          answerRevealMode: input.answerRevealMode,
          requestedQuestionCount: total,
          questionDistribution: input.questionDistribution,
          timeLimitSeconds: input.timeLimitSeconds,
          timePerQuestionSeconds: input.timePerQuestionSeconds,
          materials: { create: input.materialIds.map((materialId) => ({ materialId })) },
        },
      },
    },
    include: { versions: { include: { materials: true } } },
  });
}
