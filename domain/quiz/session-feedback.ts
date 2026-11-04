export type ConfirmedAnswer = {
  questionId: string;
  selectedOptionId: string | null;
  booleanAnswer: boolean | null;
  textAnswer: string | null;
  isCorrect: boolean | null;
  gradingStatus: "GRADED" | "PENDING" | "FAILED" | "NOT_REQUIRED";
  resolution: null | {
    explanation: string | null;
    correctOptionId: string | null;
    correctBoolean: boolean | null;
    options: Array<{ id: string; explanation: string | null }>;
    sources: Array<{ title: string; pageStart: number | null }>;
  };
};

export function toggleCut(cuts: Record<string, string[]>, questionId: string, optionId: string): Record<string, string[]> {
  const current = cuts[questionId] ?? [];
  return { ...cuts, [questionId]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] };
}

export function pendingCount(questionIds: string[], confirmed: Record<string, ConfirmedAnswer>): number {
  return questionIds.filter((id) => !confirmed[id]).length;
}
