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
  expiresAt?: string;
  memoryMb?: number;
  cpus?: number;
  revision?: number;
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
