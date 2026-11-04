import { describe, expect, test } from "bun:test";
import { pendingCount, toggleCut, type ConfirmedAnswer } from "@/domain/quiz/session-feedback";

describe("estado local do quiz", () => {
  test("cortar alternativa é reversível e não altera outras questões", () => {
    const first = toggleCut({}, "q1", "a");
    const second = toggleCut(first, "q1", "b");
    expect(toggleCut(second, "q1", "a")).toEqual({ q1: ["b"] });
    expect(first).toEqual({ q1: ["a"] });
  });

  test("pendências contam somente questões sem confirmação", () => {
    const answer: ConfirmedAnswer = { questionId: "q1", selectedOptionId: "a", booleanAnswer: null, textAnswer: null, isCorrect: true, gradingStatus: "GRADED", resolution: null };
    expect(pendingCount(["q1", "q2"], { q1: answer })).toBe(1);
  });
});
