import { describe, expect, test } from "bun:test";
import { ThemePreference } from "@/domain/enums";
import { toAppTheme } from "@/domain/settings/theme";

describe("theme preference", () => {
  test("maps persisted preferences to next-themes values", () => {
    expect(toAppTheme(ThemePreference.LIGHT)).toBe("light");
    expect(toAppTheme(ThemePreference.DARK)).toBe("dark");
    expect(toAppTheme(ThemePreference.SYSTEM)).toBe("system");
  });
});
