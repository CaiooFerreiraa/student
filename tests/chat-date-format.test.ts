import { describe, expect, test } from "bun:test";
import {
  formatConversationTimestamp,
  formatMessageTimestamp,
} from "@/domain/chat/date-format";

describe("chat date formatting", () => {
  test("formats time consistently in the configured time zone", () => {
    const timestamp = "2026-07-14T02:08:00.000Z";

    expect(formatMessageTimestamp(timestamp)).toBe("23:08");
    expect(formatConversationTimestamp(timestamp, "2026-07-14T02:30:00.000Z")).toBe("23:08");
  });

  test("formats the date when the conversation is from another local day", () => {
    expect(formatConversationTimestamp(
      "2026-07-14T02:08:00.000Z",
      "2026-07-14T03:01:00.000Z",
    )).toBe("13/07");
  });

  test("does not render invalid dates", () => {
    expect(formatMessageTimestamp("invalid")).toBe("");
    expect(formatConversationTimestamp("invalid", "2026-07-14T03:01:00.000Z")).toBe("");
  });
});
