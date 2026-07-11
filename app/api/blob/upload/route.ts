import { head } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getBlobEnv } from "@/lib/server/env";
import { getCurrentUser } from "@/lib/server/current-user";
import { registerMaterialBlob } from "@/lib/server/materials/register-material-blob";

const allowedContentTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];

export async function POST(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  const blobEnv = getBlobEnv();
  const body = await request.json() as HandleUploadBody;

  const result = await handleUpload({
    request,
    body,
    token: blobEnv.BLOB_READ_WRITE_TOKEN,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      if (!pathname.startsWith(`users/${user.id}/materials/`)) throw new Error("Pathname de upload inválido.");
      const payload = JSON.parse(clientPayload ?? "{}") as { originalName?: string };
      return {
        allowedContentTypes,
        maximumSizeInBytes: 250 * 1024 * 1024,
        addRandomSuffix: true,
        allowOverwrite: false,
        tokenPayload: JSON.stringify({ userId: user.id, originalName: payload.originalName ?? pathname.split("/").at(-1) }),
        callbackUrl: blobEnv.VERCEL_BLOB_CALLBACK_URL,
      };
    },
    onUploadCompleted: async ({ blob, tokenPayload }) => {
      const payload = JSON.parse(tokenPayload ?? "{}") as { userId?: string; originalName?: string };
      if (!payload.userId || !payload.originalName) throw new Error("Payload de upload inválido.");
      const metadata = await head(blob.pathname, { token: blobEnv.BLOB_READ_WRITE_TOKEN });
      await registerMaterialBlob(payload.userId, { ...blob, size: metadata.size, originalName: payload.originalName });
    },
  });

  return Response.json(result);
}
