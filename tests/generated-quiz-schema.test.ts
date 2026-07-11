import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { createGeneratedQuizSchema, flattenGeneratedQuiz, generatedQuizSchema } from "@/domain/quiz/generated-quiz";

type JsonSchemaNode = {
  anyOf?: JsonSchemaNode[];
  items?: JsonSchemaNode;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
};

function expectAllPropertiesRequired(schema: JsonSchemaNode): void {
  if (schema.properties) {
    expect(schema.required?.sort()).toEqual(Object.keys(schema.properties).sort());
    Object.values(schema.properties).forEach(expectAllPropertiesRequired);
  }
  if (schema.items) expectAllPropertiesRequired(schema.items);
  schema.anyOf?.forEach(expectAllPropertiesRequired);
}

describe("schema de geração do quiz", () => {
  test("gera um JSON Schema strict sem propriedades opcionais", () => {
    const schema = z.toJSONSchema(generatedQuizSchema) as unknown as JsonSchemaNode;

    expectAllPropertiesRequired(schema);
  });

  test("aceita null nos campos que não se aplicam à questão", () => {
    const result = generatedQuizSchema.safeParse({
      questions: [{
        type: "TRUE_FALSE",
        statement: "A água ferve a 100 °C ao nível do mar.",
        explanation: "A pressão atmosférica altera o ponto de ebulição.",
        difficulty: "EASY",
        points: 10,
        options: null,
        correctBoolean: true,
        modelAnswer: null,
        gradingRubric: null,
        sourceKeys: ["SOURCE_1"],
      }],
    });

    expect(result.success).toBe(true);
  });

  test("exige exatamente a distribuição configurada", () => {
    const schema = createGeneratedQuizSchema({ multipleChoice: 2, trueFalse: 1, open: 1 });
    const multipleChoice = {
      type: "MULTIPLE_CHOICE" as const,
      statement: "Qual alternativa corresponde ao conteúdo da fonte?",
      explanation: "A alternativa correta está fundamentada na fonte indicada.",
      difficulty: "MEDIUM" as const,
      points: 5,
      options: [
        { content: "Alternativa correta", isCorrect: true, explanation: "Correta." },
        { content: "Alternativa incorreta", isCorrect: false, explanation: "Incorreta." },
      ],
      correctBoolean: null,
      modelAnswer: null,
      gradingRubric: null,
      sourceKeys: ["SOURCE_1"],
    };
    const result = schema.safeParse({
      multipleChoice: [multipleChoice],
      trueFalse: [{
        type: "TRUE_FALSE",
        statement: "A afirmação apresentada está de acordo com a fonte?",
        explanation: "A fonte confirma a afirmação apresentada.",
        difficulty: "MEDIUM",
        points: 5,
        options: null,
        correctBoolean: true,
        modelAnswer: null,
        gradingRubric: null,
        sourceKeys: ["SOURCE_1"],
      }],
      open: [{
        type: "OPEN",
        statement: "Explique o conceito apresentado no material fornecido.",
        explanation: "A resposta deve recuperar os elementos centrais da fonte.",
        difficulty: "MEDIUM",
        points: 5,
        options: null,
        correctBoolean: null,
        modelAnswer: "O conceito deve ser explicado com base na fonte.",
        gradingRubric: { criteria: ["Fidelidade à fonte"] },
        sourceKeys: ["SOURCE_1"],
      }],
    });

    expect(result.success).toBe(false);
  });

  test("achata os blocos mantendo a ordem configurada", () => {
    const schema = createGeneratedQuizSchema({ multipleChoice: 0, trueFalse: 1, open: 0 });
    const parsed = schema.parse({
      multipleChoice: [],
      trueFalse: [{
        type: "TRUE_FALSE",
        statement: "A afirmação está fundamentada no material fornecido?",
        explanation: "A justificativa deve apontar a evidência da fonte.",
        difficulty: "EASY",
        points: 5,
        options: null,
        correctBoolean: true,
        modelAnswer: null,
        gradingRubric: null,
        sourceKeys: ["SOURCE_1"],
      }],
      open: [],
    });

    expect(flattenGeneratedQuiz(parsed)).toHaveLength(1);
    expect(flattenGeneratedQuiz(parsed)[0]?.type).toBe("TRUE_FALSE");
  });
});
