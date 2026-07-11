import { after } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasAiConfiguration } from "@/lib/server/env";
import { gradeEssaySubmission } from "@/lib/server/essays/grade-essay";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

export const maxDuration = 300;

export const POST = withApiErrorBoundary(async (_request: Request, context: RouteContext<"/api/essays/submissions/[id]/grade">): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  if (!hasAiConfiguration()) return Response.json({ data: null, error: "OPENAI_API_KEY não configurada." }, { status: 503 });
  after(() => gradeEssaySubmission(user.id, id));
  return Response.json({ data: { id, status: "GRADING" }, error: null }, { status: 202 });
});
