import { z } from "zod";
import { QuestionType } from "@/domain/enums";

const unsupportedVisualReference = /\b(?:em\s+destaque|destacad[oa]s?|grif(?:ad[oa]s?|o)|sublinhad[oa]s?|em\s+negrito|em\s+it[aá]lico)\b/i;
const sourceDependentStatement = /\b(?:(?:de\s+acordo|conforme)\s+com|segundo)\s+(?:o\s+)?(?:material|fonte|texto|trecho)\b|\b(?:material|fonte|texto|trecho)\s+(?:fornecid[oa]|indicad[oa]|apresentad[oa])\b/i;
const shallowSourceExplanation = /\b(?:o\s+)?(?:material|fonte|texto|trecho)\s+(?:fala|diz|afirma|informa|apresenta|mostra|indica|confirma|explica|descreve|relata)\b/i;

function hasAtLeastTwoSentences(explanation: string): boolean {
  return explanation
    .split(/[.!?]+/)
    .filter((sentence) => sentence.trim().length >= 20)
    .length >= 2;
}

const pedagogicalExplanationSchema = z.string().trim().min(
  140,
  "A explicação deve ensinar o raciocínio em pelo menos duas frases, não apenas apontar a resposta.",
).refine(
  hasAtLeastTwoSentences,
  "A explicação deve desenvolver o raciocínio em pelo menos duas frases completas.",
).refine(
  (explanation) =>
    !sourceDependentStatement.test(explanation)
    && !shallowSourceExplanation.test(explanation),
  "A explicação deve ser autossuficiente, sem usar 'o material diz' como justificativa.",
);

const generatedOptionSchema = z.object({
  content: z.string().min(1),
  isCorrect: z.boolean(),
  explanation: z.string().trim().min(
    60,
    "Cada alternativa deve explicar conceitualmente por que está correta ou incorreta.",
  ),
});

export const generatedQuestionSchema = z.object({
  type: z.enum(QuestionType),
  statement: z.string().min(10).refine(
    (statement) => !unsupportedVisualReference.test(statement),
    "O enunciado não pode depender de destaque visual que não será exibido.",
  ).refine(
    (statement) => !sourceDependentStatement.test(statement),
    "O enunciado deve ser autossuficiente e não pode mandar o aluno consultar o material ou a fonte.",
  ),
  explanation: pedagogicalExplanationSchema,
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
  modelAnswer: z.string().trim().min(120),
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
