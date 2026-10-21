import dayjs, { type ConfigType } from "dayjs";

export type AssessmentScheduleState = "upcoming" | "live" | "expired" | "invalid";

export function getAssessmentScheduleState(
  startTime?: ConfigType | null,
  endTime?: ConfigType | null,
  now: ConfigType = dayjs(),
): AssessmentScheduleState {
  const start = startTime == null || startTime === "" ? null : dayjs(startTime);
  const end = endTime == null || endTime === "" ? null : dayjs(endTime);
  const current = dayjs(now);

  if ((start && !start.isValid()) || (end && !end.isValid()) || !current.isValid()) return "invalid";
  if (start && end && !end.isAfter(start)) return "invalid";
  if (start && current.isBefore(start)) return "upcoming";
  if (end && !current.isBefore(end)) return "expired";
  return "live";
}

export function formatAssessmentDateTime(value?: ConfigType | null, format = "MMM D, YYYY h:mm A") {
  if (value == null || value === "") return "";
  const date = dayjs(value);
  return date.isValid() ? date.format(format) : "—";
}

export function formatScheduleDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours && remainingMinutes) return `${hours} hr ${remainingMinutes} min`;
  if (hours) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
