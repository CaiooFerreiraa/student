import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { registerEssayBlob } from "@/lib/server/essays/register-essay-blob";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const schema = z.object({ pathname: z.string(), url: z.string().url(), downloadUrl: z.string().url().optional(), contentType: z.string(), size: z.number().int().nonnegative(), originalName: z.string().min(1).max(255), position: z.number().int().min(0).max(9) });
export const POST = withApiErrorBoundary(async (request: Request, context: RouteContext<"/api/essays/submissions/[id]/files/complete">): Promise<Response> => { const user = await getCurrentUser(); const { id } = await context.params; const input = schema.parse(await request.json()); const file = await registerEssayBlob(user.id, { ...input, submissionId: id }); return Response.json({ data: { id: file.id }, error: null }); });
