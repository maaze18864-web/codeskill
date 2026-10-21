/** Distinguish gateway failures from spreadsheet validation errors. */
export function importErrorMessage(error: unknown, fallback: string): string {
  const failure = error as {
    response?: { status?: number; data?: unknown };
    code?: string;
    message?: string;
  } | null;
  const status = failure?.response?.status;
  const data = failure?.response?.data;
  const message = data && typeof data === "object" && "message" in data
    ? (data as { message: unknown }).message : undefined;
  if (status === 413) {
    return "Upload rejected (HTTP 413): the file or batch exceeds a server/proxy size limit. Questions allow 15 MiB and students 10 MiB per file. Ask the administrator to check the proxy limit if the file is smaller.";
  }
  if (status === 403 && typeof data !== "object") {
    return "Import blocked before validation (HTTP 403). Ask the administrator to check AWS WAF import route/body-size rules and request logs. This response does not indicate a spreadsheet format error.";
  }
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && message.every(item => typeof item === "string")) return message.join("; ");
  if (status === 403) return "You do not have permission to import. Sign in with an authorized administrator account.";
  if (status === 401) return "Your session has expired. Sign in again before importing.";
  if ([502, 503, 504].includes(status ?? 0) || failure?.code === "ECONNABORTED") {
    return "The import service is unavailable or timed out. Check the student/question directory before retrying; an earlier batch may have been saved.";
  }
  return failure?.message && !failure.response ? failure.message : fallback;
}
