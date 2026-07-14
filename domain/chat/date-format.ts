export const CHAT_TIME_ZONE = "America/Bahia";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHAT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CHAT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CHAT_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});

export function formatConversationTimestamp(value: string, referenceTime: string): string {
  const date = new Date(value);
  const referenceDate = new Date(referenceTime);

  if (Number.isNaN(date.getTime()) || Number.isNaN(referenceDate.getTime())) return "";

  return dateKeyFormatter.format(date) === dateKeyFormatter.format(referenceDate)
    ? timeFormatter.format(date)
    : shortDateFormatter.format(date);
}

export function formatMessageTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : timeFormatter.format(date);
}
