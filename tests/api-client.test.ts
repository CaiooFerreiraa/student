import { describe, expect, test } from "bun:test";
import { ApiClientError, readApiResponse } from "@/lib/api-client";

describe("readApiResponse", () => {
  test("retorna o envelope JSON de uma resposta válida", async () => {
    const response = Response.json({ data: { id: "material-1" }, error: null });

    await expect(readApiResponse<{ id: string }>(response)).resolves.toEqual({
      data: { id: "material-1" },
      error: null,
    });
  });

  test("preserva a mensagem estruturada de uma resposta HTTP com erro", async () => {
    const response = Response.json({ data: null, error: "Nome inválido." }, { status: 422 });

    try {
      await readApiResponse(response);
      throw new Error("A leitura deveria falhar.");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({ message: "Nome inválido.", status: 422 });
    }
  });

  test("não executa JSON.parse em corpo vazio", async () => {
    const response = new Response(null, { status: 500 });

    await expect(readApiResponse(response)).rejects.toMatchObject({
      message: "O servidor retornou uma resposta vazia.",
      status: 500,
    });
  });

  test("identifica resposta que não contém JSON", async () => {
    const response = new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain" },
    });

    await expect(readApiResponse(response)).rejects.toMatchObject({
      message: "O servidor retornou uma resposta inválida.",
      status: 500,
    });
  });
});
