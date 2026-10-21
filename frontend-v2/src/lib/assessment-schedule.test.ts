import { formatAssessmentDateTime, formatScheduleDuration, getAssessmentScheduleState } from "./assessment-schedule";

const start = "2026-10-19T09:52:00Z";
const end = "2026-10-19T18:52:00Z";

describe("assessment schedule boundaries", () => {
  it.each([
    ["2026-10-19T09:51:59Z", "upcoming"],
    [start, "live"],
    ["2026-10-19T18:51:59Z", "live"],
    [end, "expired"],
    ["2026-10-19T18:52:01Z", "expired"],
  ])("returns %s at the correct boundary", (now, expected) => {
    expect(getAssessmentScheduleState(start, end, now)).toBe(expected);
  });

  it("compares absolute instants across time-zone offsets", () => {
    expect(getAssessmentScheduleState("2026-10-19T15:22:00+05:30", end, start)).toBe("live");
  });

  it("supports schedules with one or both bounds omitted", () => {
    expect(getAssessmentScheduleState(null, null, start)).toBe("live");
    expect(getAssessmentScheduleState(null, end, end)).toBe("expired");
    expect(getAssessmentScheduleState(start, null, start)).toBe("live");
  });

  it("rejects malformed and reversed schedules", () => {
    expect(getAssessmentScheduleState("not-a-date", end, start)).toBe("invalid");
    expect(getAssessmentScheduleState(end, start, start)).toBe("invalid");
    expect(getAssessmentScheduleState(start, start, start)).toBe("invalid");
  });

  it("formats local wall-clock dates and per-attempt durations", () => {
    expect(formatAssessmentDateTime("2026-10-19T11:55:00", "D MMM YYYY, h:mm A")).toBe("19 Oct 2026, 11:55 AM");
    expect(formatScheduleDuration(90)).toBe("1 hr 30 min");
    expect(formatScheduleDuration(60)).toBe("1 hour");
    expect(formatScheduleDuration(0)).toBe("—");
  });
});
