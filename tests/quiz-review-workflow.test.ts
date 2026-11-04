import { describe, expect, test } from "bun:test";
import type { GeneratedQuestion } from "@/domain/quiz/generated-quiz";
import { generateReviewedQuiz } from "@/domain/quiz/review-workflow";
import { shuffleCorrectOptions } from "@/domain/quiz/shuffle-options";

function question(id: string, type: GeneratedQuestion["type"] = "MULTIPLE_CHOICE"): GeneratedQuestion {
  return {
    type, statement: id, explanation: "explicação", difficulty: "MEDIUM", points: 1,
    options: type === "MULTIPLE_CHOICE" ? [
      { content: `${id}-correta`, isCorrect: true, explanation: `${id}-explicação correta` },
      ...[1, 2, 3].map((index) => ({ content: `${id}-${index}`, isCorrect: false, explanation: `${id}-explicação ${index}` })),
    ] : null,
    correctBoolean: type === "TRUE_FALSE" ? true : null,
    modelAnswer: null, gradingRubric: null, sourceKeys: ["SOURCE_1"],
  };
}

describe("revisão de quiz", () => {
  test("mantém aprovadas e gera apenas a reposição reprovada", async () => {
    const requests: number[] = [];
    const result = await generateReviewedQuiz({
      requested: { multipleChoice: 6, trueFalse: 0, open: 0 },
      generate: async (remaining) => {
        requests.push(remaining.multipleChoice);
        return Array.from({ length: remaining.multipleChoice }, (_, index) => question(`rodada-${requests.length}-${index}`));
      },
      review: async (candidates) => candidates.map((_, index) => ({ approved: requests.length > 1 || index !== 0, reason: "gabarito ambíguo" })),
    });
    expect(requests).toEqual([6, 1]);
    expect(result).toHaveLength(6);
    expect(result.filter((item) => item.statement.startsWith("rodada-1"))).toHaveLength(5);
  });

  test("publica parcialmente a partir de cinco aprovadas após duas reposições", async () => {
    let rounds = 0;
    const result = await generateReviewedQuiz({
      requested: { multipleChoice: 8, trueFalse: 0, open: 0 },
      generate: async (remaining) => {
        rounds++;
        return Array.from({ length: remaining.multipleChoice }, (_, index) => question(`${rounds}-${index}`));
      },
      review: async (candidates) => candidates.map((_, index) => ({ approved: rounds === 1 && index < 5, reason: "fato sem fonte" })),
    });
    expect(rounds).toBe(3);
    expect(result).toHaveLength(5);
  });

  test("recusa publicação com menos de cinco aprovadas", async () => {
    let rounds = 0;
    await expect(generateReviewedQuiz({
      requested: { multipleChoice: 5, trueFalse: 0, open: 0 },
      generate: async (remaining) => {
        rounds++;
        return Array.from({ length: remaining.multipleChoice }, (_, index) => question(String(index)));
      },
      review: async (candidates) => candidates.map((_, index) => ({ approved: rounds === 1 && index < 4, reason: "ambiguidade" })),
    })).rejects.toThrow("pelo menos 5");
  });
});

describe("embaralhamento das alternativas", () => {
  test("evita três gabaritos seguidos na mesma posição com 2, 3 e 4 alternativas", () => {
    const mixed = [2, 3, 4].map((count, index) => {
      const item = question(`mista-${index}`);
      return { ...item, options: item.options!.slice(0, count) };
    });
    for (let run = 0; run < 20; run++) {
      const positions = shuffleCorrectOptions(mixed).map((item) => item.options!.findIndex((option) => option.isCorrect));
      expect(new Set(positions).size).toBeGreaterThan(1);
    }
  });

  test("equilibra as posições e preserva gabarito e explicações", () => {
    const original = Array.from({ length: 20 }, (_, index) => question(`questão-${index}`));
    const shuffled = shuffleCorrectOptions(original);
    const positions = shuffled.map((item) => item.options!.findIndex((option) => option.isCorrect));
    const counts = [0, 1, 2, 3].map((position) => positions.filter((value) => value === position).length);
    expect(counts).toEqual([5, 5, 5, 5]);
    expect(positions.every((value, index) => index < 2 || value !== positions[index - 1] || value !== positions[index - 2])).toBe(true);
    shuffled.forEach((item, index) => {
      expect(item.options?.filter((option) => option.isCorrect)).toHaveLength(1);
      expect(item.options?.find((option) => option.isCorrect)?.content).toBe(original[index]?.options?.[0]?.content);
      expect(item.options?.find((option) => option.isCorrect)?.explanation).toBe(original[index]?.options?.[0]?.explanation);
    });
  });
});
