import "server-only";
import { cache } from "react";
import { databaseEnv } from "@/lib/server/env";
import { prisma } from "@/lib/server/prisma";

export const getCurrentUser = cache(async () => {
  const user = await prisma.user.findUnique({
    where: { email: databaseEnv.DEMO_USER_EMAIL },
    include: { profile: true },
  });

  if (!user || user.deletedAt) {
    throw new Error("Usuário de desenvolvimento não encontrado. Execute `bun run db:seed`.");
  }

  return user;
});
