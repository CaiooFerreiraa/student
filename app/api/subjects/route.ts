import { getCurrentUser } from "@/lib/server/current-user";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";
import { prisma } from "@/lib/server/prisma";

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const subjects = await prisma.subject.findMany({ where: { OR: [{ ownerId: user.id }, { ownerId: null }] }, orderBy: { name: "asc" } });
  return Response.json({ data: subjects, error: null });
});
