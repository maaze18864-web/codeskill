import axios from "axios";
import toast from "react-hot-toast";

const entityNames: Record<string, string> = {
  assessments: "assessment",
  questions: "question",
  "question-banks": "question bank",
  problems: "problem",
  contests: "contest",
  students: "student",
  users: "user",
  companies: "company",
  universities: "university",
  jobs: "job",
  team: "team member",
  batches: "batch",
  applications: "application",
  discussions: "discussion",
  profile: "profile",
  notes: "note",
  bookmark: "bookmark",
};

function getMutation(path: string, method: string) {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const prefix = segments.findIndex((segment) => ["admin", "company", "campus", "discussions", "auth"].includes(segment));
  if (prefix < 0) return null;

  const resource = segments[prefix] === "discussions"
    ? "discussions"
    : segments[prefix] === "auth"
      ? segments[prefix + 1] === "avatar" ? "profile" : segments[prefix + 1]
    : segments[prefix] === "company" && (!segments[prefix + 1] || /^[0-9a-f-]{20,}$/i.test(segments[prefix + 1]))
      ? "companies"
      : segments[prefix] === "campus" && (!segments[prefix + 1] || /^[0-9a-f-]{20,}$/i.test(segments[prefix + 1]))
        ? "universities"
        : segments[prefix + 1];
  const entity = entityNames[resource];
  if (!entity) return null;

  const normalizedPath = path.split("?")[0].replace(/^\//, "");

  if (method === "delete" && /^admin\/questions\/bulk-upload-batches\/[^/]+$/.test(normalizedPath)) {
    return { entity: "bulk upload batch", action: "deleted" };
  }

  // These forms already own their feedback, including a question-to-problem fallback.
  if (
    (method === "post" && ["admin/assessments", "admin/questions"].includes(normalizedPath)) ||
    (method === "put" && /^admin\/users\/[^/]+\/(promote|demote)$/.test(normalizedPath)) ||
    (method === "put" && /^admin\/(questions|problems)\/[^/]+$/.test(normalizedPath))
  ) return null;

  let action: "created" | "updated" | "deleted";
  if (method === "post") {
    const remainder = segments.slice(prefix + (segments[prefix] === "discussions" || segments[prefix] === "auth" ? 1 : 2));
    const lastSegment = remainder[remainder.length - 1];
    if (remainder.length === 0) action = "created";
    else if (remainder[0] === "import") {
      if (lastSegment !== "confirm" && lastSegment !== "auto") return null;
      action = "created";
    } else if (
      (resource === "contests" && ["publish-results", "reattempts"].includes(lastSegment)) ||
      (resource === "contests" && lastSegment === "revoke")
    ) action = "updated";
    else if (
      (resource === "discussions" && remainder.includes("replies")) ||
      (resource === "team" && lastSegment === "invite") ||
      (resource === "applications" && lastSegment === "mock")
    ) action = "created";
    else if (resource === "profile" && lastSegment === "avatar") action = "updated";
    else return null;
  }
  else if (method === "delete") action = "deleted";
  else if (method === "put" || method === "patch") {
    if (segments.includes("vote")) return null;
    action = "updated";
  }
  else return null;

  return { entity, action };
}

function safeServerMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return undefined;
  const message = error.response?.data?.message;
  const text = Array.isArray(message) ? message.filter((item) => typeof item === "string").join(" ") : message;
  if (typeof text !== "string") return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 240 || /\b(stack| at |traceback|exception:)/i.test(clean)) return undefined;
  return clean;
}

export function notifyMutationSuccess(path: string, method = "") {
  if (typeof window === "undefined") return;
  const mutation = getMutation(path, method.toLowerCase());
  if (!mutation) return;
  const label = `${mutation.entity[0].toUpperCase()}${mutation.entity.slice(1)}`;
  toast.success(`${label} ${mutation.action} successfully.`, { id: `mutation:${method}:${path}` });
}

export function notifyMutationFailure(path: string, method = "", error: unknown) {
  if (typeof window === "undefined") return;
  const mutation = getMutation(path, method.toLowerCase());
  if (!mutation) return;
  const action = mutation.action === "created" ? "create" : mutation.action === "updated" ? "update" : "delete";
  const message = safeServerMessage(error) || `Failed to ${action} ${mutation.entity}. Please try again.`;
  toast.error(message, { id: `mutation:error:${method}:${path}` });
}
