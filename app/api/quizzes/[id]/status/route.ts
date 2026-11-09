import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { quizVersions, quizzes } from "@/lib/server/db/schema";
import { desc } from "drizzle-orm";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await auth.protect();
  const user = await getCurrentUser();
  const { id } = await context.params;
  const quiz = await db.query.quizzes.findFirst({
    where: and(eq(quizzes.id, id), eq(quizzes.ownerId, user.id), isNull(quizzes.deletedAt)),
    columns: { status: true },
    with: { quizVersions: { columns: { status: true }, orderBy: [desc(quizVersions.versionNumber)], limit: 1 } },
  });
  if (!quiz) return NextResponse.json({ error: "Quiz não encontrado." }, { status: 404 });
  return NextResponse.json({ generating: quiz.status === "GENERATING" || quiz.quizVersions[0]?.status === "GENERATING" });
}
