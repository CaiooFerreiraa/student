import "server-only";
import { auth, currentUser as getClerkUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { cache } from "react";
import { AuthenticationRequiredError } from "@/lib/server/auth/authentication-error";
import { db } from "@/lib/server/db";
import { isUniqueViolation } from "@/lib/server/db/errors";
import { profiles, userIdentities, userPreferences, users } from "@/lib/server/db/schema";

const CLERK_PROVIDER = "clerk";
type CurrentUser = typeof users.$inferSelect & { profile: typeof profiles.$inferSelect | null };

function clerkDisplayName(user: NonNullable<Awaited<ReturnType<typeof getClerkUser>>>, email: string): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username || email.split("@")[0] || "Estudante";
}

async function findByClerkSubject(subject: string): Promise<CurrentUser | null> {
  const [row] = await db
    .select({ user: users, profile: profiles })
    .from(userIdentities)
    .innerJoin(users, eq(userIdentities.userId, users.id))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(userIdentities.provider, CLERK_PROVIDER), eq(userIdentities.subject, subject)))
    .limit(1);
  return row ? { ...row.user, profile: row.profile } : null;
}

function assertAvailable(user: CurrentUser): CurrentUser {
  if (user.status !== "ACTIVE" || user.deletedAt) throw new Error("Esta conta está indisponível.");
  return user;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  if (!session.userId) throw new AuthenticationRequiredError();

  const existingIdentity = await findByClerkSubject(session.userId);
  if (existingIdentity) return assertAvailable(existingIdentity);

  const clerkUser = await getClerkUser();
  if (!clerkUser || clerkUser.id !== session.userId) throw new AuthenticationRequiredError();
  const primaryEmail = clerkUser.emailAddresses.find(
    (candidate) => candidate.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) throw new Error("A conta do Clerk não possui um e-mail válido.");

  try {
    return await db.transaction(async (transaction) => {
      const [concurrent] = await transaction
        .select({ user: users, profile: profiles })
        .from(userIdentities)
        .innerJoin(users, eq(userIdentities.userId, users.id))
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(and(eq(userIdentities.provider, CLERK_PROVIDER), eq(userIdentities.subject, session.userId)))
        .limit(1);
      if (concurrent) return assertAvailable({ ...concurrent.user, profile: concurrent.profile });

      const [sameEmail] = await transaction.select().from(users).where(eq(users.email, primaryEmail)).limit(1);
      let user = sameEmail;
      if (sameEmail) {
        const clerkIdentities = await transaction
          .select({ subject: userIdentities.subject })
          .from(userIdentities)
          .where(and(eq(userIdentities.userId, sameEmail.id), eq(userIdentities.provider, CLERK_PROVIDER)));
        if (clerkIdentities.some((item) => item.subject !== session.userId)) {
          throw new Error("Este e-mail já está associado a outra conta.");
        }
      } else {
        const now = new Date();
        [user] = await transaction.insert(users).values({
          email: primaryEmail,
          displayName: clerkDisplayName(clerkUser, primaryEmail),
          updatedAt: now,
        }).returning();
        if (!user) throw new Error("Não foi possível criar o usuário.");
        await transaction.insert(profiles).values({ userId: user.id, updatedAt: now });
        await transaction.insert(userPreferences).values({ userId: user.id, updatedAt: now });
      }

      const [profile] = await transaction.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
      await transaction.insert(userIdentities).values({
        userId: user.id,
        provider: CLERK_PROVIDER,
        subject: session.userId,
      });
      return assertAvailable({ ...user, profile: profile ?? null });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const resolved = await findByClerkSubject(session.userId);
    if (!resolved) throw error;
    return assertAvailable(resolved);
  }
});
