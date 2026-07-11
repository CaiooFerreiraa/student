export type ApiEnvelope<T> = {
  data: T | null;
  error: string | null;
  meta?: unknown;
};

export class ApiClientError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === "object" && value !== null && "data" in value && "error" in value;
}

export async function readApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();

  if (!text.trim()) {
    throw new ApiClientError("O servidor retornou uma resposta vazia.", response.status);
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiClientError("O servidor retornou uma resposta inválida.", response.status);
  }

  if (!isApiEnvelope(value)) {
    throw new ApiClientError("A resposta do servidor não segue o formato esperado.", response.status);
  }

  if (!response.ok) {
    const message = typeof value.error === "string" && value.error.trim()
      ? value.error
      : `A requisição falhou com status ${response.status}.`;
    throw new ApiClientError(message, response.status);
  }

  return value as ApiEnvelope<T>;
}
