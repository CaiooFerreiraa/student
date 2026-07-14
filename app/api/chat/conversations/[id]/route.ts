import { getCurrentUser } from "@/lib/server/current-user";
import { getChatConversation } from "@/lib/server/chat/conversation-repository";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

export const GET = withApiErrorBoundary(async (
  _request: Request,
  context: RouteContext<"/api/chat/conversations/[id]">,
): Promise<Response> => {
  const user = await getCurrentUser();
  const { id } = await context.params;
  const result = await getChatConversation(user.id, id);

  if (!result) {
    return Response.json({ data: null, error: "Conversa não encontrada." }, { status: 404 });
  }

  return Response.json({ data: result, error: null });
});
