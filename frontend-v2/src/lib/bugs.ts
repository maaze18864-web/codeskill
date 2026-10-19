import { getBrowserApiBaseURL } from "@/lib/api-base-url";

export type BugStatus = "new" | "in_process" | "fixed";
export type BugPriority = "low" | "medium" | "high" | "critical";

export interface BugImage {
  id: string;
  url: string;
  mimeType: string;
  createdAt: string;
}

export interface BugComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
  canEdit?: boolean;
}

export interface BugActivity {
  id: string;
  type: "reported" | "assigned" | "fixed" | "reopened" | "edited";
  actorName: string;
  message: string;
  createdAt: string;
}

export interface BugReport {
  id: string;
  creatorName: string;
  title: string;
  description: string;
  status: BugStatus;
  priority: BugPriority;
  assigneeName: string | null;
  fixedAt: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
  commentCount: number;
  imageCount: number;
  isAssignee?: boolean;
  isCreator?: boolean;
  canEditBug?: boolean;
  images?: BugImage[];
  comments?: BugComment[];
  activities?: BugActivity[];
}

export function bugImageSrc(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (typeof window === "undefined") return path;
  const apiBase = getBrowserApiBaseURL(process.env.NEXT_PUBLIC_API_URL, window.location);
  if (apiBase.startsWith("/")) return path;
  try {
    const base = new URL(apiBase, window.location.origin);
    base.pathname = base.pathname.replace(/\/api\/?$/, "");
    return new URL(path, base.origin).toString();
  } catch {
    return path;
  }
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = seconds;
  for (const [limit, unit] of units) {
    if (value < limit) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-Math.floor(value), unit);
    value /= limit;
  }
  return "just now";
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}

export const statusLabels: Record<BugStatus, string> = {
  new: "New",
  in_process: "In Process",
  fixed: "Fixed",
};

export const priorityLabels: Record<BugPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};
