export interface PublicContest {
  id: string;
  slug: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  problems: string[];
  format?: "mcq" | "coding" | "mixed";
  isPrivate: boolean;
}
export function parseContests(body: unknown): PublicContest[] {
  const value = body as { data?: unknown; contests?: unknown } | null;
  const rows = Array.isArray(body) ? body : value?.contests ?? value?.data;
  if (!Array.isArray(rows)) throw new Error("Invalid contest response");
  return rows.map(row => {
    if (!row || typeof row !== "object") throw new Error("Invalid contest record");
    const item = row as Record<string, unknown>;
    if (typeof item.slug !== "string" || typeof item.title !== "string" || typeof (item.id ?? item._id) !== "string") throw new Error("Invalid contest record");
    return { ...item, id: item.id ?? item._id, problems: Array.isArray(item.problems) ? item.problems : [] } as PublicContest;
  });
}
export function contestStatus(contest: Pick<PublicContest, "startTime" | "endTime">, now = Date.now()) {
  const start = new Date(contest.startTime).getTime(); const end = new Date(contest.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "Unavailable";
  return now >= end ? "Completed" : now < start ? "Upcoming" : "Live";
}
export function contestDuration(contest: Pick<PublicContest, "startTime" | "endTime">) {
  const minutes = (new Date(contest.endTime).getTime() - new Date(contest.startTime).getTime()) / 60000;
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
}
