import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  createGeneratedQuizSchema,
  flattenGeneratedQuiz,
  generatedQuizSchema,
} from "@/domain/quiz/generated-quiz";

type JsonSchemaNode = {
  anyOf?: JsonSchemaNode[];
  items?: JsonSchemaNode;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
};

const pedagogicalExplanation =
  "Ao nível do mar, a pressão atmosférica permite que a água atinja a ebulição por volta de 100 °C. Em maiores altitudes, a pressão externa diminui e a ebulição ocorre em temperatura menor, por isso o valor não é universal.";

function trueFalseQuestion(overrides: Record<string, unknown> = {}) {
  return {
    type: "TRUE_FALSE",
    statement: "A água ferve a aproximadamente 100 °C ao nível do mar.",
    explanation: pedagogicalExplanation,
    difficulty: "EASY",
    points: 10,
    options: null,
    correctBoolean: true,
    modelAnswer: null,
    gradingRubric: null,
    sourceKeys: ["SOURCE_1"],
    ...overrides,
  };
}

function expectAllPropertiesRequired(schema: JsonSchemaNode): void {
  if (schema.properties) {
    expect(schema.required?.sort()).toEqual(Object.keys(schema.properties).sort());
    Object.values(schema.properties).forEach(expectAllPropertiesRequired);
  }
  if (schema.items) expectAllPropertiesRequired(schema.items);
  schema.anyOf?.forEach(expectAllPropertiesRequired);
}

describe("schema de geração do quiz", () => {
  test("rejeita a expressão 'em destaque' quando a interface não exibe um destaque", () => {
    const schema = createGeneratedQuizSchema({ multipleChoice: 0, trueFalse: 1, open: 0 });
    const result = schema.safeParse({
      multipleChoice: [],
      trueFalse: [trueFalseQuestion({
        statement: "A expressão em destaque representa o conceito central da proposição?",
      })],
      open: [],
    });

    expect(result.success).toBe(false);
  });

  test("rejeita enunciado que depende de consulta ao material", () => {
    const result = generatedQuizSchema.safeParse({
      questions: [trueFalseQuestion({
        statement: "Segundo o material, a água ferve a aproximadamente 100 °C?",
      })],
    });

    expect(result.success).toBe(false);
  });

  test("rejeita explicação curta ou que apenas atribui a resposta ao material", () => {
    const shortResult = generatedQuizSchema.safeParse({
      questions: [trueFalseQuestion({ explanation: "A resposta está correta." })],
    });
    const sourceResult = generatedQuizSchema.safeParse({
      questions: [trueFalseQuestion({
        explanation:
          "O material afirma que a água ferve a aproximadamente 100 °C ao nível do mar, portanto a proposição deve ser aceita. Essa confirmação seria suficiente para marcar a alternativa como verdadeira, sem desenvolver outro raciocínio.",
      })],
    });

    expect(shortResult.success).toBe(false);
    expect(sourceResult.success).toBe(false);
  });

  test("exige uma justificativa conceitual para cada alternativa", () => {
    const schema = createGeneratedQuizSchema({ multipleChoice: 1, trueFalse: 0, open: 0 });
    const result = schema.safeParse({
      multipleChoice: [{
        type: "MULTIPLE_CHOICE",
        statement: "Qual situação tende a reduzir o ponto de ebulição da água?",
        explanation: pedagogicalExplanation,
        difficulty: "MEDIUM",
        points: 5,
        options: [
          {
            content: "Aumento da altitude",
            isCorrect: true,
            explanation: "Correta.",
          },
          {
            content: "Aumento da pressão externa",
            isCorrect: false,
            explanation:
              "O aumento da pressão externa exige mais energia para a formação de vapor e, por isso, eleva a temperatura de ebulição.",
          },
        ],
        correctBoolean: null,
        modelAnswer: null,
        gradingRubric: null,
        sourceKeys: ["SOURCE_1"],
      }],
      trueFalse: [],
      open: [],
    });

    expect(result.success).toBe(false);
  });

  test("gera um JSON Schema strict sem propriedades opcionais", () => {
    const schema = z.toJSONSchema(generatedQuizSchema) as unknown as JsonSchemaNode;

    expectAllPropertiesRequired(schema);
  });

  test("aceita uma explicação didática e null nos campos que não se aplicam", () => {
    const result = generatedQuizSchema.safeParse({
      questions: [trueFalseQuestion()],
    });

    expect(result.success).toBe(true);
  });

  test("exige exatamente a distribuição configurada", () => {
    const schema = createGeneratedQuizSchema({ multipleChoice: 0, trueFalse: 2, open: 0 });
    const result = schema.safeParse({
      multipleChoice: [],
      trueFalse: [trueFalseQuestion()],
      open: [],
    });

    expect(result.success).toBe(false);
  });

  test("achata os blocos mantendo a ordem configurada", () => {
    const schema = createGeneratedQuizSchema({ multipleChoice: 0, trueFalse: 1, open: 0 });
    const parsed = schema.parse({
      multipleChoice: [],
      trueFalse: [trueFalseQuestion()],
      open: [],
    });

    expect(flattenGeneratedQuiz(parsed)).toHaveLength(1);
    expect(flattenGeneratedQuiz(parsed)[0]?.type).toBe("TRUE_FALSE");
  });
});
