export interface ProjectFile {
  path: string;
  content: string;
}
export interface Project {
  id: string;
  name: string;
  mode: "frontend" | "backend" | "fullstack";
  frontendStack: string | null;
  backendStack: string | null;
  files: ProjectFile[];
  directories?: string[];
  labAssignment?: {
    labId: string;
    experimentId: string;
    problemId: string;
    title: string;
    instructions: string;
  } | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export interface Stack {
  id: string;
  name: string;
  description: string;
}
export interface ProjectCatalog {
  frontend: Stack[];
  backend: Stack[];
  limits: {
    maxFiles: number;
    maxBytes: number;
    idleMinutes: number;
    maxMinutes: number;
  };
}
export interface ProjectRuntime {
  state: "stopped" | "starting" | "ready" | "failed" | "expired";
  logs: string[];
  previewUrl: string | null;
  backendUrl?: string | null;
  expiresAt?: string;
  memoryMb?: number;
  cpus?: number;
  revision?: number;
}
export function projectBackendUrl(
  project: Pick<Project, "frontendStack" | "backendStack">,
  runtime: ProjectRuntime,
) {
  if (runtime.state !== "ready") return null;
  if (runtime.backendUrl !== undefined) return runtime.backendUrl;
  // Keep existing running controllers compatible while they are being updated.
  if (!runtime.previewUrl) return null;
  if (project.backendStack)
    return new URL("__backend/", runtime.previewUrl).href;
  return project.frontendStack === "nextjs" ? runtime.previewUrl : null;
}
// Framework logs describe the container's loopback listener. Browsers must use
// the isolated preview proxy; never expose the container's port to the host.
export function projectPreviewLogs(runtime: ProjectRuntime) {
  if (runtime.state !== "ready") return runtime.logs;
  return runtime.logs.map((line) => {
    let text = line;
    if (runtime.previewUrl) {
      const preview = new URL(runtime.previewUrl);
      for (const host of ["127.0.0.1", "localhost", "[::1]"])
        text = text.replaceAll(
          `http://${host}:4173${preview.pathname}`,
          preview.href,
        );
    }
    if (runtime.backendUrl)
      text = text.replace(
        /http:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):3001(?=\/|\s|$)\/?/g,
        runtime.backendUrl,
      );
    return text;
  });
}
export interface ProjectResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  durationMs: number;
}
export interface ProjectTerminalSession {
  terminalId: string;
  alive: boolean;
  exitCode: number | null;
}
export interface ProjectTerminalOutput extends ProjectTerminalSession {
  cursor: number;
  data: string;
  truncated: boolean;
}
export function projectLanguage(path: string) {
  const ext = path.split(".").pop()?.toLowerCase();
  return (
    (
      {
        js: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        json: "json",
        css: "css",
        html: "html",
        py: "python",
        java: "java",
        xml: "xml",
        properties: "ini",
        md: "markdown",
        vue: "html",
        svelte: "html",
        yml: "yaml",
        yaml: "yaml",
        sql: "sql",
        sh: "shell",
      } as Record<string, string>
    )[ext || ""] || "plaintext"
  );
}
export function validProjectPath(
  path: string,
  files: ProjectFile[],
  oldPath?: string,
) {
  return (
    /^[a-zA-Z0-9_.@()\- /]+$/.test(path) &&
    path.length <= 160 &&
    !path.startsWith("/") &&
    !path
      .split("/")
      .some(
        (part) =>
          !part ||
          [".", "..", "node_modules", ".git", "__pycache__"].includes(part),
      ) &&
    !files.some(
      (f) =>
        f.path !== oldPath &&
        (f.path === path ||
          f.path.startsWith(path + "/") ||
          path.startsWith(f.path + "/")),
    )
  );
}
export function formatProjectBody(body: string) {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
export function projectLabsHref(role?: string) {
  return ["admin", "super_admin"].includes(role || "")
    ? "/admin/labs"
    : ["teacher", "faculty", "instructor"].includes(role || "")
      ? "/teacher/labs"
      : "/labs";
}
