const directiveQuestion = /\b(?:assinale|marque|indique|explique|analise|julgue|considere)\b[^\n]{20,300}/gi;
const questionWithMark = /[^?\n]{15,300}\?/g;
const stopWords = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "entre",
  "essa", "esse", "esta", "este", "foi", "mais", "na", "nas", "no", "nos", "o", "os", "ou", "para",
  "pela", "pelas", "pelo", "pelos", "por", "qual", "quais", "que", "se", "segundo", "ser", "sobre", "um", "uma",
  "analise", "assinale", "considere", "explique", "indique", "julgue", "marque",
]);

function normalizedText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(normalizedText(value).split(" ").filter((token) => token.length > 2 && !stopWords.has(token)));
}

function isNearCopy(statement: string, sourceQuestion: string): boolean {
  const normalizedStatement = normalizedText(statement);
  const normalizedSource = normalizedText(sourceQuestion);
  if (normalizedSource.length >= 12 && (
    normalizedStatement.includes(normalizedSource) || normalizedSource.includes(normalizedStatement)
  )) return true;

  const statementTokens = meaningfulTokens(statement);
  const sourceTokens = meaningfulTokens(sourceQuestion);
  const smallerSize = Math.min(statementTokens.size, sourceTokens.size);
  if (smallerSize < 5) return false;
  const intersection = [...statementTokens].filter((token) => sourceTokens.has(token)).length;
  const overlap = intersection / smallerSize;
  const union = new Set([...statementTokens, ...sourceTokens]).size;
  return intersection >= 5 && (overlap >= 0.78 || intersection / union >= 0.68);
}

export function extractSourceQuestions(sourceContents: string[]): string[] {
  const candidates = sourceContents.flatMap((content) => [
    ...(content.match(questionWithMark) ?? []),
    ...(content.match(directiveQuestion) ?? []),
  ]);
  return [...new Set(candidates.map((candidate) => candidate.replace(/\s+/g, " ").trim()))];
}

export function assertGeneratedQuestionsAreOriginal(
  questions: ReadonlyArray<{ statement: string }>,
  sourceContents: string[],
): void {
  const sourceQuestions = extractSourceQuestions(sourceContents);
  for (const question of questions) {
    const reused = sourceQuestions.find((sourceQuestion) => isNearCopy(question.statement, sourceQuestion));
    if (reused) {
      throw new Error(
        `A questão gerada reutiliza uma pergunta da fonte. Crie outro enunciado e outra situação a partir do assunto, sem copiar ou parafrasear: "${reused.slice(0, 180)}"`,
      );
    }
  }
}
