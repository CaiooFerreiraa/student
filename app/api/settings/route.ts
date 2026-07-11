import { z } from "zod";
import { EducationLevel, ThemePreference } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/server/current-user";
import { prisma } from "@/lib/server/prisma";

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

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  const full = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { profile: true, preferences: true } });
  return Response.json({ data: { displayName: full.displayName, bio: full.profile?.bio ?? "", educationLevel: full.profile?.educationLevel ?? EducationLevel.UNDERGRADUATE, primaryGoal: full.profile?.primaryGoal ?? "", weeklyStudyGoalMinutes: full.profile?.weeklyStudyGoalMinutes ?? 480, theme: full.preferences?.theme ?? ThemePreference.LIGHT, reviewNotifications: full.preferences?.reviewNotifications ?? true, weeklySummary: full.preferences?.weeklySummary ?? true, processingNotifications: full.preferences?.processingNotifications ?? true, alwaysShowSources: full.preferences?.alwaysShowSources ?? true, adaptToEducationLevel: full.preferences?.adaptToEducationLevel ?? true }, error: null });
}

export async function PATCH(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  const input = schema.parse(await request.json());
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { displayName: input.displayName } }),
    prisma.profile.upsert({ where: { userId: user.id }, update: { bio: input.bio, educationLevel: input.educationLevel, primaryGoal: input.primaryGoal, weeklyStudyGoalMinutes: input.weeklyStudyGoalMinutes }, create: { userId: user.id, bio: input.bio, educationLevel: input.educationLevel, primaryGoal: input.primaryGoal, weeklyStudyGoalMinutes: input.weeklyStudyGoalMinutes } }),
    prisma.userPreference.upsert({ where: { userId: user.id }, update: { theme: input.theme, reviewNotifications: input.reviewNotifications, weeklySummary: input.weeklySummary, processingNotifications: input.processingNotifications, alwaysShowSources: input.alwaysShowSources, adaptToEducationLevel: input.adaptToEducationLevel }, create: { userId: user.id, theme: input.theme, reviewNotifications: input.reviewNotifications, weeklySummary: input.weeklySummary, processingNotifications: input.processingNotifications, alwaysShowSources: input.alwaysShowSources, adaptToEducationLevel: input.adaptToEducationLevel } }),
  ]);
  return Response.json({ data: input, error: null });
}
