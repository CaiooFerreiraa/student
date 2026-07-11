import { after } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { hasAiConfiguration } from "@/lib/server/env";
import { generateQuizVersion } from "@/lib/server/quizzes/generate-quiz";

export const maxDuration = 300;

export async function POST(_request: Request, context: RouteContext<"/api/quizzes/[id]/generate">): Promise<Response> {
  const user = await getCurrentUser();
  const { id } = await context.params;
  if (!hasAiConfiguration()) return Response.json({ data: null, error: "OPENAI_API_KEY não configurada." }, { status: 503 });
  after(() => generateQuizVersion(user.id, id));
  return Response.json({ data: { id, status: "GENERATING" }, error: null }, { status: 202 });
}
