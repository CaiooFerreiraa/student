import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  const subjects = await prisma.subject.findMany({ where: { OR: [{ ownerId: user.id }, { ownerId: null }] }, orderBy: { name: "asc" } });
  return Response.json({ data: subjects, error: null });
}
