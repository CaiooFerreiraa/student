type DatabaseError = { code?: unknown; cause?: unknown };

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as DatabaseError;
  if (typeof candidate.code === "string") return candidate.code;
  return errorCode(candidate.cause);
}

export function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === "23505";
}
