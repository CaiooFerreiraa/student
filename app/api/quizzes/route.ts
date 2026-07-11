import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";
import { createQuizSchema } from "@/domain/quiz/quiz-config";
import { createQuiz } from "@/lib/server/quizzes/create-quiz";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  const quizzes = await prisma.quiz.findMany({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { subject: true, currentVersion: { select: { id: true, versionNumber: true, requestedQuestionCount: true } }, attempts: { where: { status: "SUBMITTED" }, orderBy: { submittedAt: "desc" }, take: 1 } },
  });
  return Response.json({ data: quizzes, error: null });
}

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  const input = createQuizSchema.parse(await request.json());
  const quiz = await createQuiz(user.id, input);
  return Response.json({ data: quiz, error: null }, { status: 201 });
}
