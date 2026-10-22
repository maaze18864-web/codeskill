const indiaDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** Explicit IST formatting, independent of the browser or server's time zone. */
export function formatIndianDateTime(value: unknown, timeOnly = false): string {
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return "Not available";
  if (typeof value === "string" && !value.trim()) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  const parts = Object.fromEntries(indiaDateTime.formatToParts(date).map(part => [part.type, part.value]));
  const time = `${parts.hour}:${parts.minute}:${parts.second} IST`;
  return timeOnly ? time : `${parts.day}/${parts.month}/${parts.year} ${time}`;
}
