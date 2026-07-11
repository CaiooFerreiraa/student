import { after } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { processMaterialJob } from "@/lib/server/materials/process-material";
import { registerMaterialBlob } from "@/lib/server/materials/register-material-blob";

export const maxDuration = 300;

const inputSchema = z.object({
  pathname: z.string().min(1),
  url: z.string().url(),
  downloadUrl: z.string().url().optional(),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative(),
  originalName: z.string().min(1).max(255),
  subjectName: z.string().trim().min(2).max(100).optional(),
});

export const POST = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  const input = inputSchema.parse(await request.json());
  const material = await registerMaterialBlob(user.id, input);
  after(() => processMaterialJob(material.id));
  return Response.json({ data: { id: material.id, status: material.processingStatus }, error: null });
});
