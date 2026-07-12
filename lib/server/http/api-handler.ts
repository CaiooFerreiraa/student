import "server-only";
import { z } from "zod";
import { AuthenticationRequiredError } from "@/lib/server/auth/authentication-error";

type ApiHandler<Arguments extends unknown[]> = (...args: Arguments) => Promise<Response>;

function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Os dados enviados são inválidos.";

  const field = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${field}${issue.message}`;
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return Response.json({ data: null, error: error.message }, { status: 401 });
  }

  if (error instanceof z.ZodError) {
    return Response.json({ data: null, error: validationMessage(error) }, { status: 400 });
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      { data: null, error: "O corpo da requisição não contém um JSON válido." },
      { status: 400 },
    );
  }

  console.error("Erro não tratado em Route Handler:", error);
  return Response.json({ data: null, error: "Erro interno do servidor." }, { status: 500 });
}

export function withApiErrorBoundary<Arguments extends unknown[]>(handler: ApiHandler<Arguments>): ApiHandler<Arguments> {
  return async (...args: Arguments): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
