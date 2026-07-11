import { after } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { transcribeEssaySubmission } from "@/lib/server/essays/transcribe-essay";

export const maxDuration = 300;

export async function POST(_request: Request, context: RouteContext<"/api/essays/submissions/[id]/transcribe">): Promise<Response> {
  const user = await getCurrentUser();
  const { id } = await context.params;
  after(() => transcribeEssaySubmission(user.id, id));
  return Response.json({ data: { id, status: "EXTRACTING" }, error: null }, { status: 202 });
}
