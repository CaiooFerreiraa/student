import { describe, expect, test } from "bun:test";
import { findActiveNavigationHref } from "@/domain/navigation/active-route";

const hrefs = ["/", "/quizzes", "/quizzes/create", "/materials"];

describe("active navigation route", () => {
  test("prefers the most specific matching route", () => {
    expect(findActiveNavigationHref("/quizzes/create", hrefs)).toBe("/quizzes/create");
  });

  test("keeps the parent active for children without a dedicated item", () => {
    expect(findActiveNavigationHref("/quizzes/session", hrefs)).toBe("/quizzes");
  });

  test("matches the home route only exactly", () => {
    expect(findActiveNavigationHref("/materials", hrefs)).toBe("/materials");
    expect(findActiveNavigationHref("/unknown", hrefs)).toBeNull();
  });
});
