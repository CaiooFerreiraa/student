import { z } from "zod";
import { GradingStatus } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";

const schema = z.object({ questionId: z.string().uuid(), selectedOptionId: z.string().uuid().nullable().optional(), booleanAnswer: z.boolean().nullable().optional(), textAnswer: z.string().max(10_000).nullable().optional() });

export const PUT = withApiErrorBoundary(async (request: Request, context: RouteContext<"/api/attempts/[id]/answers">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const input = schema.parse(await request.json());
  const attempt = await prisma.quizAttempt.findFirst({ where: { id, userId: user.id, status: "IN_PROGRESS" } });
  if (!attempt) return Response.json({ data: null, error: "Tentativa não encontrada ou já finalizada." }, { status: 409 });
  const question = await prisma.question.findFirst({ where: { id: input.questionId, quizVersionId: attempt.quizVersionId } });
  if (!question) return Response.json({ data: null, error: "Questão inválida." }, { status: 400 });
  const answer = await prisma.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    update: { selectedOptionId: input.selectedOptionId, booleanAnswer: input.booleanAnswer, textAnswer: input.textAnswer, gradingStatus: question.type === "OPEN" ? GradingStatus.PENDING : GradingStatus.NOT_REQUIRED, answeredAt: new Date() },
    create: { attemptId: attempt.id, questionId: question.id, selectedOptionId: input.selectedOptionId, booleanAnswer: input.booleanAnswer, textAnswer: input.textAnswer, gradingStatus: question.type === "OPEN" ? GradingStatus.PENDING : GradingStatus.NOT_REQUIRED },
  });
  return Response.json({ data: answer, error: null });
});
