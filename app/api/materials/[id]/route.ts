import { after } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { hasBlobConfiguration } from "@/lib/server/env";
import { deleteMaterialBlob } from "@/lib/server/materials/delete-material";
import { scheduleMaterialDeletion } from "@/lib/server/materials/schedule-material-deletion";

export const DELETE = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/materials/[id]">): Promise<Response> => {
  const user = await getCurrentUser(); const { id } = await context.params;
  const result = await scheduleMaterialDeletion(user.id, id);
  if (result.status === "not_found") return Response.json({ data: null, error: "Material não encontrado." }, { status: 404 });
  if (result.status === "processing") return Response.json({ data: null, error: "Aguarde o processamento terminar antes de excluir o material." }, { status: 409 });
  if (hasBlobConfiguration()) after(() => deleteMaterialBlob(user.id, id));
  return new Response(null, { status: 204 });
});
