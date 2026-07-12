import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { getBlobEnv } from "@/lib/server/env";
import { registerEssayBlob } from "@/lib/server/essays/register-essay-blob";

const payloadSchema = z.object({ submissionId: z.string().uuid(), originalName: z.string().min(1).max(255), position: z.number().int().min(0).max(9) });

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const env = getBlobEnv();
  const body = await request.json() as HandleUploadBody;
  const result = await handleUpload({
    request,
    body,
    token: env.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const user = await getCurrentUser();
      const payload = payloadSchema.parse(JSON.parse(clientPayload ?? "{}"));
      if (!pathname.startsWith(`users/${user.id}/essays/${payload.submissionId}/`)) throw new Error("Pathname inválido.");
      return {
        allowedContentTypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "image/jpeg", "image/png", "image/webp"],
        maximumSizeInBytes: 15 * 1024 * 1024,
        addRandomSuffix: true,
        allowOverwrite: false,
        tokenPayload: JSON.stringify({ ...payload, userId: user.id }),
        callbackUrl: env.VERCEL_BLOB_CALLBACK_URL,
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const payload = payloadSchema.extend({ userId: z.string().uuid() }).parse(JSON.parse(tokenPayload ?? "{}"));
      const metadata = await head(blob.pathname, { token: env.BLOB_READ_WRITE_TOKEN });
      await registerEssayBlob(payload.userId, { ...blob, size: metadata.size, submissionId: payload.submissionId, originalName: payload.originalName, position: payload.position });
    },
  });
  return Response.json(result);
});
