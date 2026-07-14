import type { ThemePreference } from "@/domain/enums";

export type AppTheme = "light" | "dark" | "system";

const preferenceToTheme: Record<ThemePreference, AppTheme> = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
};

export function toAppTheme(preference: ThemePreference): AppTheme {
  return preferenceToTheme[preference];
}
