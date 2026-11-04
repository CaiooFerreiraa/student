import "server-only";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { GeneratedQuestion } from "@/domain/quiz/generated-quiz";
import type { QuestionSourceReference } from "@/lib/server/quizzes/persist-generated-quiz";

const reviewSchema = z.object({ verdicts: z.array(z.object({
  index: z.number().int().nonnegative(),
  approved: z.boolean(),
  reason: z.string(),
})) });

export const QUIZ_REVIEW_PROMPT_VERSION = "quiz-review-v1";

export async function reviewGeneratedQuestions(input: {
  model: ChatOpenAI;
  questions: GeneratedQuestion[];
  approvedQuestions: GeneratedQuestion[];
  sources: Map<string, QuestionSourceReference>;
}): Promise<Array<{ approved: boolean; reason: string }>> {
  const sourceKeys = [...new Set(input.questions.flatMap((question) => question.sourceKeys))];
  const sourceContext = sourceKeys.map((key) => {
    const source = input.sources.get(key);
    return { key, content: source?.content ?? null };
  });
  const reviewer = createAgent({
    model: input.model,
    tools: [],
    responseFormat: reviewSchema,
    systemPrompt: `Você é um revisor independente de quizzes educacionais. Avalie cada questão separadamente contra as fontes fornecidas. Reprove fatos não sustentados, gabaritos errados, duas alternativas plausivelmente corretas, distratores enganosos, enunciados ambíguos, explicações incorretas ou fracas, respostas-modelo e rubricas inadequadas, questões repetidas ou próximas às já aprovadas. Não corrija nem reescreva questões: retorne um parecer para cada índice. Não aceite uma SOURCE inexistente. Responda em português do Brasil. Versão: ${QUIZ_REVIEW_PROMPT_VERSION}.`,
  });
  const result = await reviewer.invoke({ messages: [{ role: "user", content: JSON.stringify({
    sources: sourceContext,
    alreadyApproved: input.approvedQuestions.map((question) => question.statement),
    questions: input.questions.map((question, index) => ({ index, ...question })),
  }) }] });
  const verdicts = result.structuredResponse.verdicts;
  const byIndex = new Map(verdicts.map((verdict) => [verdict.index, verdict]));
  if (byIndex.size !== input.questions.length || verdicts.length !== input.questions.length || verdicts.some((verdict) => verdict.index >= input.questions.length)) {
    throw new Error("O agente revisor não avaliou todas as questões exatamente uma vez.");
  }
  return input.questions.map((_, index) => {
    const verdict = byIndex.get(index)!;
    const hasValidSources = input.questions[index]!.sourceKeys.every((key) => input.sources.has(key));
    return { approved: verdict.approved && hasValidSources, reason: hasValidSources ? verdict.reason : "A questão cita uma fonte inexistente." };
  });
}
