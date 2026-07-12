import { beforeAll, describe, expect, mock, spyOn, test } from "bun:test";
import { z } from "zod";
import { AuthenticationRequiredError } from "@/lib/server/auth/authentication-error";

mock.module("server-only", () => ({}));

let withApiErrorBoundary: typeof import("@/lib/server/http/api-handler").withApiErrorBoundary;

beforeAll(async () => {
  ({ withApiErrorBoundary } = await import("@/lib/server/http/api-handler"));
});

describe("withApiErrorBoundary", () => {
  test("converte ausência de sessão em envelope JSON 401", async () => {
    const handler = withApiErrorBoundary(async () => {
      throw new AuthenticationRequiredError();
    });

    const response = await handler();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ data: null, error: "Autenticação necessária." });
  });

  test("converte falha de validação em envelope JSON 400", async () => {
    const handler = withApiErrorBoundary(async () => {
      z.object({ name: z.string().min(2) }).parse({ name: "" });
      return Response.json({ data: true, error: null });
    });

    const response = await handler();
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({ data: null });
    expect(body.error).toBeString();
  });

  test("converte JSON malformado em envelope JSON 400", async () => {
    const handler = withApiErrorBoundary(async () => {
      await new Request("http://localhost/api/test", { method: "POST", body: "" }).json();
      return Response.json({ data: true, error: null });
    });

    const response = await handler();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ data: null, error: "O corpo da requisição não contém um JSON válido." });
  });

  test("não expõe detalhes internos de erro inesperado", async () => {
    const errorLog = spyOn(console, "error").mockImplementation(() => undefined);
    const handler = withApiErrorBoundary(async () => {
      throw new Error("DATABASE_URL=segredo");
    });

    const response = await handler();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ data: null, error: "Erro interno do servidor." });
    expect(errorLog).toHaveBeenCalledTimes(1);
    errorLog.mockRestore();
  });
});
