import { z } from "zod";
import { QuestionType } from "@/generated/prisma/enums";

const generatedOptionSchema = z.object({
  content: z.string().min(1),
  isCorrect: z.boolean(),
  explanation: z.string().nullable(),
});

export const generatedQuestionSchema = z.object({
  type: z.enum(QuestionType),
  statement: z.string().min(10),
  explanation: z.string().min(10),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  points: z.number().int().min(1).max(100),
  options: z.array(generatedOptionSchema).nullable(),
  correctBoolean: z.boolean().nullable(),
  modelAnswer: z.string().nullable(),
  gradingRubric: z.object({ criteria: z.array(z.string()) }).nullable(),
  sourceKeys: z.array(z.string()).min(1),
});

export const generatedQuizSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedQuizDistribution = {
  multipleChoice: number;
  trueFalse: number;
  open: number;
};
export type GeneratedQuizGroups = {
  multipleChoice: GeneratedQuestion[];
  trueFalse: GeneratedQuestion[];
  open: GeneratedQuestion[];
};

const multipleChoiceQuestionSchema = generatedQuestionSchema
  .extend({
    type: z.literal(QuestionType.MULTIPLE_CHOICE),
    options: z.array(generatedOptionSchema).min(2),
    correctBoolean: z.null(),
    modelAnswer: z.null(),
    gradingRubric: z.null(),
  })
  .refine(
    (question) =>
      question.options.filter((option) => option.isCorrect).length === 1,
    {
      message:
        "A questão de múltipla escolha deve ter exatamente uma alternativa correta.",
      path: ["options"],
    },
  );

const trueFalseQuestionSchema = generatedQuestionSchema.extend({
  type: z.literal(QuestionType.TRUE_FALSE),
  options: z.null(),
  correctBoolean: z.boolean(),
  modelAnswer: z.null(),
  gradingRubric: z.null(),
});

const openQuestionSchema = generatedQuestionSchema.extend({
  type: z.literal(QuestionType.OPEN),
  options: z.null(),
  correctBoolean: z.null(),
  modelAnswer: z.string().min(10),
  gradingRubric: z.object({ criteria: z.array(z.string().min(3)).min(1) }),
});

export function createGeneratedQuizSchema(
  distribution: GeneratedQuizDistribution,
) {
  return z.object({
    multipleChoice: z
      .array(multipleChoiceQuestionSchema)
      .length(distribution.multipleChoice),
    trueFalse: z.array(trueFalseQuestionSchema).length(distribution.trueFalse),
    open: z.array(openQuestionSchema).length(distribution.open),
  });
}

export function flattenGeneratedQuiz(
  result: GeneratedQuizGroups,
): GeneratedQuestion[] {
  return [...result.multipleChoice, ...result.trueFalse, ...result.open];
}
