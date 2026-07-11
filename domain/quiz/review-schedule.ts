export function nextReviewInterval(percentage: number): number {
  if (!Number.isFinite(percentage)) throw new Error("Percentual inválido.");
  if (percentage >= 80) return 7;
  if (percentage >= 60) return 3;
  return 1;
}
