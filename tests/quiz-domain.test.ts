import { describe, expect, test } from "bun:test";
import { createQuizSchema } from "@/domain/quiz/quiz-config";
import { nextReviewInterval } from "@/domain/quiz/review-schedule";

describe("configuração do quiz", () => {
  const base = { title: "Revisão constitucional", educationLevel: "UNDERGRADUATE", difficulty: "MEDIUM", questionDistribution: { multipleChoice: 5, trueFalse: 3, open: 2 }, materialIds: [] };
  test("aceita uma distribuição válida", () => { expect(createQuizSchema.safeParse(base).success).toBe(true); });
  test("recusa menos de cinco questões", () => { expect(createQuizSchema.safeParse({ ...base, questionDistribution: { multipleChoice: 2, trueFalse: 1, open: 0 } }).success).toBe(false); });
  test("recusa mais de cinquenta questões", () => { expect(createQuizSchema.safeParse({ ...base, questionDistribution: { multipleChoice: 30, trueFalse: 20, open: 1 } }).success).toBe(false); });
});

describe("repetição espaçada inicial", () => {
  test("agenda sete dias para alto aproveitamento", () => expect(nextReviewInterval(80)).toBe(7));
  test("agenda três dias para aproveitamento intermediário", () => expect(nextReviewInterval(65)).toBe(3));
  test("agenda um dia para baixo aproveitamento", () => expect(nextReviewInterval(42)).toBe(1));
});
