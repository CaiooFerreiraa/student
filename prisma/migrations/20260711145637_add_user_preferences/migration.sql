-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" UUID NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'LIGHT',
    "reviewNotifications" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT true,
    "processingNotifications" BOOLEAN NOT NULL DEFAULT true,
    "alwaysShowSources" BOOLEAN NOT NULL DEFAULT true,
    "adaptToEducationLevel" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
