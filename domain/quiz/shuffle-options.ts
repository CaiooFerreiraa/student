import { randomInt } from "node:crypto";
import type { GeneratedQuestion } from "@/domain/quiz/generated-quiz";

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
}

function repetitionScore(values: number[]): number {
  return values.reduce((total, value, index) => {
    if (index === 0 || value !== values[index - 1]) return total;
    return total + (index >= 2 && value === values[index - 2] ? 100 : 1);
  }, 0);
}

export function shuffleCorrectOptions(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  const groups = new Map<number, number[]>();
  questions.forEach((question, index) => {
    if (!question.options) return;
    const indexes = groups.get(question.options.length) ?? [];
    indexes.push(index);
    groups.set(question.options.length, indexes);
  });

  let targets = new Map<number, number>();
  let bestScore = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = new Map<number, number>();
    for (const [optionCount, questionIndexes] of groups) {
      const offset = randomInt(optionCount);
      const slots = shuffle(Array.from({ length: questionIndexes.length }, (_, index) => (index + offset) % optionCount));
      questionIndexes.forEach((questionIndex, index) => candidate.set(questionIndex, slots[index]!));
    }
    const sequence = questions.flatMap((question, index) => question.options ? [candidate.get(index)!] : []);
    const score = repetitionScore(sequence);
    if (score < bestScore) {
      targets = candidate;
      bestScore = score;
    }
    if (score === 0) break;
  }

  return questions.map((question, index) => {
    if (!question.options) return question;
    const options = shuffle(question.options);
    const currentCorrect = options.findIndex((option) => option.isCorrect);
    if (currentCorrect < 0) throw new Error("Questão de múltipla escolha sem alternativa correta.");
    const target = targets.get(index)!;
    [options[currentCorrect], options[target]] = [options[target]!, options[currentCorrect]!];
    return { ...question, options };
  });
}
