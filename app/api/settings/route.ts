import { z } from "zod";
import { eq } from "drizzle-orm";
import { EducationLevel, ThemePreference } from "@/domain/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { db } from "@/lib/server/db";
import { profiles, userPreferences, users } from "@/lib/server/db/schema";
import { withApiErrorBoundary } from "@/lib/server/http/api-handler";

const schema = z.object({
  displayName: z.string().trim().min(2).max(120),
  bio: z.string().trim().max(500).nullable(),
  educationLevel: z.enum(EducationLevel),
  primaryGoal: z.string().trim().max(160).nullable(),
  weeklyStudyGoalMinutes: z.number().int().min(30).max(10_080),
  theme: z.enum(ThemePreference),
  reviewNotifications: z.boolean(),
  weeklySummary: z.boolean(),
  processingNotifications: z.boolean(),
  alwaysShowSources: z.boolean(),
  adaptToEducationLevel: z.boolean(),
});

export const GET = withApiErrorBoundary(async (): Promise<Response> => {
  const user = await getCurrentUser();
  const [preferences] = await db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1);
  return Response.json({ data: { displayName: user.displayName, bio: user.profile?.bio ?? "", educationLevel: user.profile?.educationLevel ?? EducationLevel.UNDERGRADUATE, primaryGoal: user.profile?.primaryGoal ?? "", weeklyStudyGoalMinutes: user.profile?.weeklyStudyGoalMinutes ?? 480, theme: preferences?.theme ?? ThemePreference.LIGHT, reviewNotifications: preferences?.reviewNotifications ?? true, weeklySummary: preferences?.weeklySummary ?? true, processingNotifications: preferences?.processingNotifications ?? true, alwaysShowSources: preferences?.alwaysShowSources ?? true, adaptToEducationLevel: preferences?.adaptToEducationLevel ?? true }, error: null });
});

export const PATCH = withApiErrorBoundary(async (request: Request): Promise<Response> => {
  const user = await getCurrentUser();
  const input = schema.parse(await request.json());
  const updatedAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction.update(users).set({ displayName: input.displayName, updatedAt }).where(eq(users.id, user.id));
    await transaction.insert(profiles).values({ userId: user.id, bio: input.bio, educationLevel: input.educationLevel, primaryGoal: input.primaryGoal, weeklyStudyGoalMinutes: input.weeklyStudyGoalMinutes, updatedAt }).onConflictDoUpdate({ target: profiles.userId, set: { bio: input.bio, educationLevel: input.educationLevel, primaryGoal: input.primaryGoal, weeklyStudyGoalMinutes: input.weeklyStudyGoalMinutes, updatedAt } });
    await transaction.insert(userPreferences).values({ userId: user.id, theme: input.theme, reviewNotifications: input.reviewNotifications, weeklySummary: input.weeklySummary, processingNotifications: input.processingNotifications, alwaysShowSources: input.alwaysShowSources, adaptToEducationLevel: input.adaptToEducationLevel, updatedAt }).onConflictDoUpdate({ target: userPreferences.userId, set: { theme: input.theme, reviewNotifications: input.reviewNotifications, weeklySummary: input.weeklySummary, processingNotifications: input.processingNotifications, alwaysShowSources: input.alwaysShowSources, adaptToEducationLevel: input.adaptToEducationLevel, updatedAt } });
  });
  return Response.json({ data: input, error: null });
});
