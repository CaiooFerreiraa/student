import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { getBlobEnv } from "@/lib/server/env";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { registerMaterialBlob } from "@/lib/server/materials/register-material-blob";

const allowedContentTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];

const clientPayloadSchema = z.object({
  originalName: z.string().min(1).max(255),
  subjectName: z.string().trim().min(2).max(100).optional(),
});

const tokenPayloadSchema = clientPayloadSchema.extend({ userId: z.string().uuid() });

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const blobEnv = getBlobEnv();
  const body = await request.json() as HandleUploadBody;

  const result = await handleUpload({
    request,
    body,
    token: blobEnv.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const user = await getCurrentUser();
      if (!pathname.startsWith(`users/${user.id}/materials/`)) throw new Error("Pathname de upload inválido.");
      const payload = clientPayloadSchema.parse(JSON.parse(clientPayload ?? "{}"));
      return {
        allowedContentTypes,
        maximumSizeInBytes: 250 * 1024 * 1024,
        addRandomSuffix: true,
        allowOverwrite: false,
        tokenPayload: JSON.stringify({ userId: user.id, originalName: payload.originalName, subjectName: payload.subjectName }),
        callbackUrl: blobEnv.VERCEL_BLOB_CALLBACK_URL,
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const payload = tokenPayloadSchema.parse(JSON.parse(tokenPayload ?? "{}"));
      const metadata = await head(blob.pathname, { token: blobEnv.BLOB_READ_WRITE_TOKEN });
      await registerMaterialBlob(payload.userId, { ...blob, size: metadata.size, originalName: payload.originalName, subjectName: payload.subjectName });
    },
  });

  return Response.json(result);
});
