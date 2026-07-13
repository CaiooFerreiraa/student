import { describe, expect, test } from "bun:test";
import {
  assertGeneratedQuestionsAreOriginal,
  extractSourceQuestions,
} from "@/domain/quiz/generated-quiz-quality";

describe("originalidade das questões geradas", () => {
  test("identifica perguntas e comandos de exercício presentes na fonte", () => {
    const source = [
      "A pressão atmosférica varia com a altitude. Como a altitude influencia o ponto de ebulição da água?\nExplique a relação entre pressão externa e mudança de estado usando um exemplo concreto.",
    ];

    const questions = extractSourceQuestions(source);

    expect(questions).toHaveLength(2);
    expect(questions.some((question) => question.includes("Como a altitude"))).toBe(true);
    expect(questions.some((question) => question.startsWith("Explique"))).toBe(true);
  });

  test("rejeita cópia e paráfrase próxima de uma pergunta da fonte", () => {
    const source = [
      "Explique como a pressão atmosférica influencia o ponto de ebulição da água.",
    ];

    expect(() => assertGeneratedQuestionsAreOriginal(
      [{ statement: "Explique como a pressão atmosférica influencia o ponto de ebulição da água." }],
      source,
    )).toThrow("reutiliza uma pergunta da fonte");
    expect(() => assertGeneratedQuestionsAreOriginal(
      [{ statement: "Analise de que modo o ponto de ebulição da água é influenciado pela pressão atmosférica." }],
      source,
    )).toThrow("reutiliza uma pergunta da fonte");
  });

  test("aceita uma nova situação que avalia o mesmo assunto", () => {
    const source = [
      "Explique como a pressão atmosférica influencia o ponto de ebulição da água.",
    ];

    expect(() => assertGeneratedQuestionsAreOriginal(
      [{ statement: "Uma receita preparada no alto de uma montanha demora mais para cozinhar. Qual fenômeno explica essa diferença?" }],
      source,
    )).not.toThrow();
  });
});
