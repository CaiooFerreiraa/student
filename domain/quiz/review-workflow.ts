import type { GeneratedQuestion, GeneratedQuizDistribution } from "@/domain/quiz/generated-quiz";

export async function generateReviewedQuiz(input: {
  requested: GeneratedQuizDistribution;
  generate: (remaining: GeneratedQuizDistribution, approved: GeneratedQuestion[], reasons: string[]) => Promise<GeneratedQuestion[]>;
  review: (candidates: GeneratedQuestion[], approved: GeneratedQuestion[]) => Promise<Array<{ approved: boolean; reason: string }>>;
}): Promise<GeneratedQuestion[]> {
  const approved: GeneratedQuestion[] = [];
  let remaining = { ...input.requested };
  let reasons: string[] = [];
  for (let round = 0; round < 3; round++) {
    if (remaining.multipleChoice + remaining.trueFalse + remaining.open === 0) break;
    let candidates: GeneratedQuestion[];
    try {
      candidates = await input.generate(remaining, approved, reasons);
    } catch (error) {
      if (approved.length < 5) throw error;
      break;
    }
    const verdicts = await input.review(candidates, approved);
    if (verdicts.length !== candidates.length) throw new Error("A revisão não avaliou todas as questões.");
    reasons = [];
    candidates.forEach((question, index) => {
      const verdict = verdicts[index]!;
      if (verdict.approved) approved.push(question);
      else reasons.push(`${question.type}: ${verdict.reason}`);
    });
    remaining = {
      multipleChoice: input.requested.multipleChoice - approved.filter((question) => question.type === "MULTIPLE_CHOICE").length,
      trueFalse: input.requested.trueFalse - approved.filter((question) => question.type === "TRUE_FALSE").length,
      open: input.requested.open - approved.filter((question) => question.type === "OPEN").length,
    };
  }
  if (approved.length < 5) throw new Error(`A revisão aprovou apenas ${approved.length} questões; são necessárias pelo menos 5.`);
  return approved;
}
