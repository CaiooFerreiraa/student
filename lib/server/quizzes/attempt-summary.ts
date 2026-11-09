import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { quizAttempts } from "@/lib/server/db/schema";

export async function getAttemptSummary(userId: string) {
  const [row] = await db.select({
    completed: sql<number>`count(*)::int`,
    answered: sql<number>`coalesce(sum(${quizAttempts.correctCount} + ${quizAttempts.incorrectCount} + ${quizAttempts.unansweredCount}), 0)::int`,
    average: sql<number>`coalesce(avg(coalesce(${quizAttempts.percentage}, 0)), 0)::float8`,
    seconds: sql<number>`coalesce(sum(${quizAttempts.durationSeconds}), 0)::int`,
  }).from(quizAttempts).where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, "SUBMITTED")));
  return row ?? { completed: 0, answered: 0, average: 0, seconds: 0 };
}

export async function getStudyStreak(userId: string) {
  const rows = await db.select({ day: sql<string>`(${quizAttempts.submittedAt} AT TIME ZONE 'UTC')::date::text` })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, "SUBMITTED"), isNotNull(quizAttempts.submittedAt)))
    .groupBy(sql`(${quizAttempts.submittedAt} AT TIME ZONE 'UTC')::date`)
    .orderBy(sql`(${quizAttempts.submittedAt} AT TIME ZONE 'UTC')::date DESC`);
  const days = new Set(rows.map((row) => row.day));
  const cursor = new Date();
  if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
