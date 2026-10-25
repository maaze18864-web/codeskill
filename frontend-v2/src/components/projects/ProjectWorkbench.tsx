"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Download,
  ExternalLink,
  FileCode2,
  Files,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Server,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { projectsAPI } from "@/config/api";
import {
  LabsModal,
  labsAction,
  labsError,
  labsPrimary,
} from "@/components/labs/LabsUI";
import { ProjectApiClient } from "./ProjectApiClient";
import { ProjectPreviewFrame } from "./ProjectPreviewFrame";
import { ProjectBackendAddress } from "./ProjectBackendAddress";
import { ProjectBrowserConsole } from "./ProjectBrowserConsole";
import { useProjectConsole } from "@/hooks/useProjectConsole";
import {
  ProjectExplorer,
  type ExplorerEntry,
  type ExplorerAction,
} from "./ProjectExplorer";
import {
  createProjectEntry,
  deleteProjectEntry,
  moveProjectEntry,
  projectDirectories,
  projectParent,
  projectSnapshot,
  remapProjectPath,
  mergeProjectDirectories,
  type ProjectDocument,
} from "@/lib/project-explorer";
import {
  ProjectCodeEditor,
  type ProjectCodeEditorHandle,
} from "./ProjectCodeEditor";
import { mergeProjectFiles, projectFileHashes } from "@/lib/project-files";
import {
  projectLanguage,
  projectBackendUrl,
  projectPreviewLogs,
  type Project,
  type ProjectFile,
  type ProjectRuntime,
} from "@/lib/project-workspace";
const ProjectTerminal = dynamic(() => import("./ProjectTerminal"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-xs text-muted-foreground">
      Opening Bash terminal…
    </div>
  ),
});
const stopped: ProjectRuntime = {
  state: "stopped",
  logs: [],
  previewUrl: null,
};
const iconButton =
  "inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40";

export function ProjectWorkbench({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null),
    [files, setFiles] = useState<ProjectFile[]>([]),
    [directories, setDirectories] = useState<string[]>([]),
    [activePath, setActivePath] = useState(""),
    [tabs, setTabs] = useState<string[]>([]);
  const [runtime, setRuntime] = useState<ProjectRuntime>(stopped),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [saveState, setSaveState] = useState("Saved"),
    [previewKey, setPreviewKey] = useState(0),
    [runtimeRevision, setRuntimeRevision] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [outputTab, setOutputTab] = useState("preview"),
    [consoleOpen, setConsoleOpen] = useState(true),
    [consoleTab, setConsoleTab] = useState("logs");
  const [fileDialog, setFileDialog] = useState<ExplorerAction | null>(null),
    [fileTarget, setFileTarget] = useState<ExplorerEntry>({
      path: "",
      folder: true,
    }),
    [fileName, setFileName] = useState(""),
    [fileError, setFileError] = useState("");
  const [runtimeDirectories, setRuntimeDirectories] = useState<string[]>([]),
    [fileSyncNotice, setFileSyncNotice] = useState("");
  const [observedRuntimeFiles, setObservedRuntimeFiles] = useState<
    ProjectFile[] | null
  >(null);
  const fileSnapshot = useRef<{
    instanceId: string;
    fingerprint: string;
    hashes: Record<string, string>;
    directories: string[];
  } | null>(null);
  const filePoll = useRef<Promise<void> | null>(null);
  const codeEditor = useRef<ProjectCodeEditorHandle | null>(null);
  const previewFrame = useRef<HTMLIFrameElement | null>(null);
  const browserConsole = useProjectConsole(
    previewFrame,
    runtime.state === "ready" ? runtime.previewUrl : null,
    previewKey,
  );
  const filesRef = useRef(files),
    directoriesRef = useRef(directories),
    revision = useRef(1),
    saved = useRef(""),
    savePromise = useRef<Promise<number> | null>(null),
    conflict = useRef(false),
    mounted = useRef(true),
    runtimeRef = useRef(runtime);
  useLayoutEffect(() => {
    filesRef.current = files;
    directoriesRef.current = directories;
    runtimeRef.current = runtime;
  }, [files, directories, runtime]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!authLoading && !user)
      router.replace(`/login?redirect=/projects/${id}`);
  }, [user, authLoading, router, id]);
  useEffect(() => {
    if (!user) return;
    let live = true;
    projectsAPI
      .get(id)
      .then(({ data }) => {
        if (!live) return;
        const p: Project = data.project;
        revision.current = p.revision;
        const folders = projectDirectories(p.files, p.directories || []);
        saved.current = projectSnapshot(p.files, folders);
        setProject(p);
        setFiles(p.files);
        setDirectories(folders);
        const entry =
          p.files.find(
            (f) =>
              f.path ===
              (p.frontendStack === "nextjs"
                ? "frontend/app/page.js"
                : p.frontendStack
                  ? `frontend/src/main.${p.frontendStack === "react" ? "jsx" : "js"}`
                  : p.backendStack === "springboot"
                    ? "backend/src/main/java/com/codeskill/project/Application.java"
                    : p.backendStack === "flask" || p.backendStack === "fastapi"
                      ? "backend/main.py"
                      : "backend/server.js"),
          ) || p.files[0];
        setActivePath(entry.path);
        setTabs([entry.path]);
        setOutputTab(
          p.labAssignment
            ? "instructions"
            : p.frontendStack
              ? "preview"
              : "api",
        );
      })
      .catch((e) => {
        if (live) setError(labsError(e, "Could not open project."));
      });
    projectsAPI
      .status(id)
      .then(({ data }) => {
        if (live) {
          setRuntime(data);
          setRuntimeRevision(data.revision || 0);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, user]);
  const save = useCallback(
    async function saveProject(): Promise<number> {
      if (savePromise.current) {
        await savePromise.current;
        if (
          projectSnapshot(filesRef.current, directoriesRef.current) !==
          saved.current
        )
          return saveProject();
        return revision.current;
      }
      if (conflict.current)
        throw Error(
          "Resolve the save conflict before running. Download your files, then reload.",
        );
      const snapshot = projectSnapshot(
        filesRef.current,
        directoriesRef.current,
      );
      if (snapshot === saved.current) return revision.current;
      setSaving(true);
      setSaveState("Saving…");
      const promise = projectsAPI
        .save(id, { revision: revision.current, ...JSON.parse(snapshot) })
        .then(({ data }) => {
          revision.current = data.project.revision;
          saved.current = snapshot;
          if (mounted.current) {
            setProject((p) =>
              p ? { ...p, revision: data.project.revision } : p,
            );
            setSaveState("Saved");
          }
          return revision.current;
        })
        .catch((e) => {
          if (e.response?.status === 409) conflict.current = true;
          if (mounted.current) {
            setSaveState("Not saved");
            setError(
              labsError(
                e,
                "Could not save. Your edits are still in the editor.",
              ),
            );
          }
          throw e;
        })
        .finally(() => {
          savePromise.current = null;
          if (mounted.current) setSaving(false);
        });
      savePromise.current = promise;
      return promise;
    },
    [id],
  );
  useEffect(() => {
    if (
      !project ||
      !files.length ||
      projectSnapshot(files, directories) === saved.current ||
      conflict.current
    )
      return;
    setSaveState("Unsaved");
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 1400);
    return () => clearTimeout(timer);
  }, [files, directories, project, save]);
  useEffect(() => {
    const preventLoss = (e: BeforeUnloadEvent) => {
      if (
        projectSnapshot(filesRef.current, directoriesRef.current) !==
        saved.current
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, []);
  const hasProject = project !== null;
  const refreshFiles = useCallback(
    async (signal?: AbortSignal) => {
      if (filePoll.current) return filePoll.current;
      const poll = (async () => {
        const previous = fileSnapshot.current;
        const { data } = await projectsAPI.files(
          id,
          previous?.fingerprint,
          signal,
        );
        if (signal?.aborted || !mounted.current || data.unchanged) return;
        const local = filesRef.current;
        const [localHashes, remoteHashes] = await Promise.all([
          projectFileHashes(local),
          projectFileHashes(data.files),
        ]);
        if (signal?.aborted || !mounted.current || filesRef.current !== local)
          return;
        const base =
          previous?.instanceId === data.instanceId
            ? previous.hashes
            : data.baseHashes;
        const merged = mergeProjectFiles(
          local,
          data.files,
          base,
          localHashes,
          remoteHashes,
          data.complete,
        );
        fileSnapshot.current = {
          instanceId: data.instanceId,
          fingerprint: data.fingerprint,
          hashes: { ...(!data.complete ? base : {}), ...remoteHashes },
          directories: data.directories,
        };
        filesRef.current = merged.files;
        setFiles(merged.files);
        const folders = projectDirectories(
          merged.files,
          mergeProjectDirectories(
            directoriesRef.current,
            previous?.instanceId === data.instanceId
              ? previous.directories
              : data.baseDirectories || [],
            data.directories,
            data.complete,
          ),
        ).filter(
          (directory) =>
            !merged.files.some(
              (file) =>
                file.path === directory ||
                directory.startsWith(file.path + "/"),
            ),
        );
        directoriesRef.current = folders;
        setDirectories(folders);
        setObservedRuntimeFiles(data.files);
        setRuntimeDirectories(data.directories);
        setTabs((open) =>
          open.filter((path) =>
            merged.files.some((file) => file.path === path),
          ),
        );
        setActivePath((path) =>
          merged.files.some((file) => file.path === path)
            ? path
            : merged.files[0]?.path || "",
        );
        setFileSyncNotice(
          merged.conflicts.length
            ? `Editor changes kept for ${merged.conflicts.slice(0, 3).join(", ")}. Apply changes to use the editor version.`
            : !data.complete
              ? "Some runtime files exceed editor limits or are not text files. They remain in the terminal."
              : "",
        );
      })();
      filePoll.current = poll;
      try {
        await poll;
      } finally {
        if (filePoll.current === poll) filePoll.current = null;
      }
    },
    [id],
  );
  useEffect(() => {
    if (!hasProject || busy || runtime.state !== "ready") return;
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === "visible")
        void refreshFiles(controller.signal).catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [id, hasProject, busy, runtime.state, refreshFiles]);
  useEffect(() => {
    if (!hasProject) return;
    let live = true;
    const timer = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !busy &&
        ["ready", "starting"].includes(runtimeRef.current.state)
      )
        projectsAPI
          .status(id)
          .then(({ data }) => {
            if (live) {
              setRuntime(data);
              setRuntimeRevision(data.revision || 0);
            }
          })
          .catch(() => {});
    }, 5000);
    const heartbeat = setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        runtimeRef.current.state === "ready"
      )
        void projectsAPI.heartbeat(id).catch(() => {});
    }, 30000);
    return () => {
      live = false;
      clearInterval(timer);
      clearInterval(heartbeat);
    };
  }, [id, hasProject, busy]);
  const apply = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await codeEditor.current?.format();
      if (runtimeRef.current.state === "ready") {
        await filePoll.current?.catch(() => {});
        await refreshFiles();
      }
      const rev = await save();
      if (runtimeRef.current.state === "ready") {
        const { data } = await projectsAPI.sync(id);
        setRuntime(data);
        setRuntimeRevision(rev);
        setPreviewKey((k) => k + 1);
      }
    } catch (e) {
      setError(
        labsError(
          e,
          e instanceof Error ? e.message : "Could not apply changes.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }, [id, busy, save, refreshFiles]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void apply();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [apply]);
  async function run() {
    setBusy(true);
    setError("");
    setRuntime((r) => ({ ...r, state: "starting" }));
    try {
      const rev = await save();
      const { data } = await projectsAPI.start(id);
      setRuntime(data);
      setRuntimeRevision(rev);
      setPreviewKey((k) => k + 1);
      setConsoleOpen(true);
    } catch (e) {
      setError(labsError(e, "Could not start project."));
      try {
        const { data } = await projectsAPI.status(id);
        setRuntime(data);
      } catch {
        setRuntime(stopped);
      }
    } finally {
      setBusy(false);
    }
  }
  async function stop() {
    setBusy(true);
    try {
      await filePoll.current?.catch(() => {});
      await refreshFiles();
      await save();
      const { data } = await projectsAPI.stop(id);
      setRuntime(data);
    } catch (e) {
      setError(labsError(e, "Could not stop project."));
    } finally {
      setBusy(false);
    }
  }
  function openFile(path: string) {
    setActivePath(path);
    setTabs((t) => (t.includes(path) ? t : [...t, path]));
  }
  function editFile(value?: string) {
    const next = filesRef.current.map((item) =>
      item.path === activePath ? { ...item, content: value || "" } : item,
    );
    filesRef.current = next;
    setFiles(next);
  }
  function updateDocument(next: ProjectDocument, from?: string, to?: string) {
    filesRef.current = next.files;
    directoriesRef.current = next.directories;
    setFiles(next.files);
    setDirectories(next.directories);
    setSaveState("Unsaved");
    const remap = (path: string) =>
      from && to ? remapProjectPath(path, from, to) : path;
    setTabs((open) =>
      open
        .map(remap)
        .filter((path) => next.files.some((file) => file.path === path)),
    );
    setActivePath((path) =>
      next.files.some((file) => file.path === remap(path))
        ? remap(path)
        : next.files[0]?.path || "",
    );
  }
  function openExplorerDialog(action: ExplorerAction, target: ExplorerEntry) {
    setFileDialog(action);
    setFileTarget(target);
    setFileError("");
    const parent = target.folder ? target.path : projectParent(target.path);
    setFileName(action === "rename" ? target.path : parent ? parent + "/" : "");
  }
  function fileAction(event?: React.FormEvent) {
    event?.preventDefault();
    const document = {
      files: filesRef.current,
      directories: directoriesRef.current,
    };
    try {
      if (fileDialog === "delete")
        updateDocument(deleteProjectEntry(document, fileTarget.path));
      else if (fileDialog === "rename")
        updateDocument(
          moveProjectEntry(document, fileTarget.path, fileName.trim()),
          fileTarget.path,
          fileName.trim(),
        );
      else {
        updateDocument(
          createProjectEntry(
            document,
            fileName.trim(),
            fileDialog === "new-folder",
          ),
        );
        if (fileDialog === "new-file") openFile(fileName.trim());
      }
      setFileDialog(null);
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : "Could not update the project.",
      );
    }
  }
  function moveEntry(source: string, directory: string) {
    const destination = [directory, source.split("/").pop()]
      .filter(Boolean)
      .join("/");
    if (source === destination) return;
    try {
      updateDocument(
        moveProjectEntry(
          { files: filesRef.current, directories: directoriesRef.current },
          source,
          destination,
        ),
        source,
        destination,
      );
      setError("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not move the file or folder.",
      );
    }
  }
  async function download() {
    if (downloading) return;
    setDownloading(true);
    try {
      if (runtimeRef.current.state === "ready") {
        await filePoll.current?.catch(() => {});
        await refreshFiles();
      }
      const { createProjectZip } = await import("@/lib/project-download");
      const { bytes, filename } = createProjectZip(
        project?.name || "project",
        filesRef.current,
        directoriesRef.current,
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/zip" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(
        labsError(e, "Could not download the project ZIP. Please try again."),
      );
    } finally {
      setDownloading(false);
    }
  }
  if (!project)
    return (
      <div className="grid min-h-[70vh] place-items-center p-8 text-sm">
        {error ? (
          <div className="space-y-4">
            <p className="text-destructive">{error}</p>
            <Link className={labsAction} href="/projects">
              Back to projects
            </Link>
          </div>
        ) : (
          "Opening workspace…"
        )}
      </div>
    );
  const current = files.find((f) => f.path === activePath),
    ready = runtime.state === "ready";
  const backendUrl = projectBackendUrl(project, runtime);
  const runtimeSourceChanged =
    (ready &&
      JSON.stringify(projectDirectories(files, directories)) !==
        JSON.stringify(
          projectDirectories(observedRuntimeFiles || files, runtimeDirectories),
        )) ||
    (observedRuntimeFiles
      ? files.length !== observedRuntimeFiles.length ||
        files.some(
          (file) =>
            !observedRuntimeFiles.some(
              (other) =>
                other.path === file.path && other.content === file.content,
            ),
        )
      : project.revision !== runtimeRevision);
  const backHref = project.labAssignment
    ? `${["teacher", "faculty", "instructor"].includes(user?.role || "") ? "/teacher" : ""}/labs/${project.labAssignment.labId}/experiments/${project.labAssignment.experimentId}`
    : "/projects";
  return (
    <div className="fixed inset-0 z-40 flex min-w-[700px] flex-col bg-background text-foreground">
      <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-3 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-5">
          <Link
            href={backHref}
            aria-label={
              project.labAssignment ? "Back to experiment" : "Back to projects"
            }
            className={iconButton}
            onClick={(e) => {
              if (
                projectSnapshot(filesRef.current, directoriesRef.current) !==
                saved.current
              ) {
                e.preventDefault();
                void save()
                  .then(() => router.push(backHref))
                  .catch(() => {});
              }
            }}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div
            aria-label="Chandigarh University + CodeSkill"
            className="flex shrink-0 items-center gap-3"
          >
            <div className="flex items-center gap-2">
              <Image
                src="/cu-emblem.png"
                alt=""
                width={119}
                height={148}
                className="h-9 w-auto shrink-0"
              />
              <span className="flex flex-col text-[11px] font-semibold leading-[1.35] tracking-wide">
                <span>Chandigarh</span>
                <span className="font-medium text-muted-foreground">
                  University
                </span>
              </span>
            </div>
            <span
              aria-hidden="true"
              className="text-lg font-light text-muted-foreground/50"
            >
              +
            </span>
            <div className="flex items-center gap-2">
              <Image
                src="/email/codeskill-mark.png"
                alt=""
                width={240}
                height={270}
                className="h-7 w-auto shrink-0"
              />
              <span className="text-[15px] font-bold tracking-tight">
                CodeSkill
              </span>
            </div>
          </div>
          <div className="hidden min-w-0 border-l border-border pl-4 md:block">
            <h1 className="truncate text-[13px] font-semibold leading-5">
              {project.name}
            </h1>
            <p className="truncate text-[10px] leading-4 text-muted-foreground">
              {[project.frontendStack, project.backendStack]
                .filter(Boolean)
                .join(" + ")}{" "}
              <span className="mx-1">/</span> Project workspace
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            role="status"
            className="mr-1 hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex"
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : saveState === "Saved" ? (
              <Check className="size-3" />
            ) : (
              <span className="size-1.5 rounded-full bg-amber-500" />
            )}
            {saveState}
          </span>
          <button
            className={labsAction}
            onClick={download}
            aria-label="Download project ZIP"
            title="Download project ZIP"
            disabled={downloading || busy}
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
          </button>
          <button className={labsAction} onClick={apply} disabled={busy}>
            <Save className="size-3.5" />
            {ready ? "Apply changes" : "Save"}
          </button>
          {ready ? (
            <button onClick={stop} disabled={busy} className={labsAction}>
              <Square className="size-3.5" />
              Stop
            </button>
          ) : (
            <button onClick={run} disabled={busy} className={labsPrimary}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              {busy ? "Starting…" : "Run project"}
            </button>
          )}
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive"
        >
          <span>{error}</span>
          <button
            className={iconButton}
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-border bg-muted/20 pt-4">
          <Files className="size-5 text-primary" />
          <button
            aria-label="Toggle console"
            onClick={() => setConsoleOpen((v) => !v)}
            className={iconButton}
          >
            <Terminal className="size-5" />
          </button>
        </aside>
        <Group orientation="horizontal" className="min-w-0 flex-1">
          <Panel
            id="explorer"
            defaultSize="17%"
            minSize="12%"
            maxSize="30%"
            className="flex flex-col bg-muted/15"
          >
            <ProjectExplorer
              name={project.name}
              files={files}
              directories={directories}
              activePath={activePath}
              ready={ready}
              onOpen={openFile}
              onAction={openExplorerDialog}
              onMove={moveEntry}
              editing={
                fileDialog && fileDialog !== "delete"
                  ? {
                      action: fileDialog,
                      entry: fileTarget,
                      value: fileName,
                      error: fileError,
                    }
                  : null
              }
              onEditChange={(value) => {
                setFileName(value);
                setFileError("");
              }}
              onEditCommit={() => fileAction()}
              onEditCancel={() => setFileDialog(null)}
              onRefresh={() => {
                void refreshFiles().catch((e) =>
                  setError(labsError(e, "Could not refresh runtime files.")),
                );
              }}
            />
            <div className="border-t border-border px-3 py-3 text-[10px] leading-5 text-muted-foreground">
              {files.length}/100 files ·{" "}
              {Math.ceil(new Blob([JSON.stringify(files)]).size / 1024)} KB
              <br />
              Files and folders persist after runtime expiry.
              {ready && (
                <p className="mt-1">
                  Terminal files and folders sync automatically.
                </p>
              )}
              {fileSyncNotice && (
                <p
                  role="status"
                  className="mt-1 text-amber-700 dark:text-amber-400"
                >
                  {fileSyncNotice}
                </p>
              )}
            </div>
          </Panel>
          <Separator className="w-1 shrink-0 bg-border/60 transition-colors data-[separator=hover]:bg-primary/40" />
          <Panel
            id="code"
            defaultSize="48%"
            minSize="25%"
            className="flex min-h-0 flex-col"
          >
            <div className="flex h-10 shrink-0 overflow-x-auto border-b border-border bg-muted/20">
              {tabs
                .filter((t) => files.some((f) => f.path === t))
                .map((path) => (
                  <div
                    key={path}
                    className={`group flex shrink-0 items-center border-r border-border border-t-2 ${path === activePath ? "border-t-primary bg-background" : "border-t-transparent text-muted-foreground"}`}
                  >
                    <button
                      onClick={() => setActivePath(path)}
                      className="flex items-center gap-2 px-3 text-xs"
                    >
                      <FileCode2 className="size-3.5" />
                      {path.split("/").pop()}
                    </button>
                    <button
                      aria-label={`Close ${path}`}
                      className="mr-2 rounded p-1 hover:bg-muted"
                      onClick={() => {
                        const next = tabs.filter((t) => t !== path);
                        setTabs(next);
                        if (activePath === path)
                          setActivePath(next.at(-1) || files[0].path);
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
            </div>
            <ProjectCodeEditor
              ref={codeEditor}
              path={`${id}/${activePath}`}
              value={current?.content || ""}
              theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
              onChange={editFile}
              onRename={() =>
                openExplorerDialog("rename", {
                  path: activePath,
                  folder: false,
                })
              }
              onDelete={() =>
                openExplorerDialog("delete", {
                  path: activePath,
                  folder: false,
                })
              }
            />
            {consoleOpen && (
              <section className="flex h-[260px] min-h-[160px] max-h-[65vh] shrink-0 resize-y flex-col overflow-hidden border-t border-border bg-card">
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
                  <div className="flex h-full gap-4">
                    {[
                      "logs",
                      ...(project.frontendStack ? ["console"] : []),
                      "terminal",
                    ].map((t) => (
                      <button
                        key={t}
                        onClick={() => setConsoleTab(t)}
                        className={`border-b-2 text-[10px] font-semibold uppercase tracking-wide ${consoleTab === t ? "border-primary" : "border-transparent text-muted-foreground"}`}
                      >
                        {t === "logs"
                          ? "Server logs"
                          : t === "console"
                            ? "Console"
                            : "Terminal"}
                      </button>
                    ))}
                  </div>
                  <button
                    aria-label="Close console"
                    className={iconButton}
                    onClick={() => setConsoleOpen(false)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                {consoleTab === "logs" ? (
                  <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-2 font-mono text-[11px] leading-5">
                    {projectPreviewLogs(runtime).join("\n") ||
                      "Run the project to see server output."}
                  </pre>
                ) : consoleTab === "console" ? (
                  <ProjectBrowserConsole
                    entries={browserConsole.entries}
                    onClear={browserConsole.clear}
                    ready={ready}
                  />
                ) : (
                  <ProjectTerminal
                    key={`${id}:${previewKey}`}
                    id={id}
                    ready={ready && !busy}
                  />
                )}
              </section>
            )}
          </Panel>
          <Separator className="w-1 shrink-0 bg-border/60 transition-colors data-[separator=hover]:bg-primary/40" />
          <Panel
            id="output"
            defaultSize="35%"
            minSize="25%"
            className="flex min-h-0 flex-col bg-card"
          >
            <div className="flex h-10 shrink-0 items-stretch border-b border-border bg-muted/20">
              {project.labAssignment && (
                <button
                  onClick={() => setOutputTab("instructions")}
                  className={`flex items-center gap-2 border-b-2 px-4 text-xs ${outputTab === "instructions" ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}
                >
                  <ClipboardList className="size-3.5" />
                  Instructions
                </button>
              )}
              {project.frontendStack && (
                <button
                  onClick={() => setOutputTab("preview")}
                  className={`flex items-center gap-2 border-b-2 px-4 text-xs ${outputTab === "preview" ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}
                >
                  <Globe className="size-3.5" />
                  Preview
                </button>
              )}
              {(project.backendStack || project.frontendStack === "nextjs") && (
                <button
                  onClick={() => setOutputTab("api")}
                  className={`flex items-center gap-2 border-b-2 px-4 text-xs ${outputTab === "api" ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}
                >
                  <Server className="size-3.5" />
                  API Client
                </button>
              )}
            </div>
            {outputTab === "instructions" && project.labAssignment && (
              <div className="min-h-0 flex-1 overflow-auto p-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Lab project exercise
                </p>
                <h2 className="mt-2 text-lg font-semibold">
                  {project.labAssignment.title}
                </h2>
                <p className="mt-4 whitespace-pre-wrap text-xs leading-7 text-muted-foreground">
                  {project.labAssignment.instructions}
                </p>
                <p className="mt-5 rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-6 text-muted-foreground">
                  Complete the TODO sections in your files, then run the project
                  and verify the behavior with Preview or API Client. Your saved
                  work is independent of the original starter.
                </p>
              </div>
            )}
            {outputTab === "preview" && (
              <>
                <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
                  <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                    Frontend
                  </span>
                  <button
                    className={iconButton}
                    aria-label="Refresh preview"
                    disabled={!ready}
                    onClick={() => setPreviewKey((k) => k + 1)}
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                  <span
                    className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1 font-mono text-[10px] text-muted-foreground"
                    title={ready ? runtime.previewUrl || undefined : undefined}
                  >
                    {ready && runtime.previewUrl
                      ? runtime.previewUrl
                      : "No running preview"}
                  </span>
                  {ready && runtime.previewUrl && (
                    <a
                      href={runtime.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={iconButton}
                      aria-label="Open preview in new tab"
                      title="Open preview in new tab"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <span
                    className={`size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                  />
                </div>
                {(project.backendStack ||
                  project.frontendStack === "nextjs") && (
                  <ProjectBackendAddress
                    url={backendUrl}
                    healthPath={project.backendStack ? "health" : "api/hello"}
                    frontendStack={project.frontendStack}
                  />
                )}
              </>
            )}
            {/* Keep the frontend alive across output tabs so its state and
                console stream continue while students inspect API responses. */}
            {project.frontendStack && (
              <ProjectPreviewFrame
                frameRef={previewFrame}
                url={ready ? runtime.previewUrl : null}
                generation={previewKey}
                visible={outputTab === "preview"}
                busy={busy}
              />
            )}
            {outputTab === "api" && (
              <div className="min-h-0 flex-1">
                <ProjectApiClient
                  id={id}
                  ready={ready}
                  backendUrl={backendUrl}
                  builtinApi={
                    !project.backendStack && project.frontendStack === "nextjs"
                  }
                  frontendStack={project.frontendStack}
                />
              </div>
            )}
            {ready && runtimeSourceChanged && (
              <div className="border-t border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground">
                Saved changes are ready.{" "}
                <button
                  className="font-semibold text-primary"
                  onClick={apply}
                  disabled={busy}
                >
                  Apply changes
                </button>{" "}
                to refresh the runtime.
              </div>
            )}
          </Panel>
        </Group>
      </div>
      <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span
            className={`size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
          />
          <span className="capitalize">{runtime.state}</span>
          <span className="hidden md:inline">
            · {runtime.cpus || 1} CPU /{" "}
            {((runtime.memoryMb || 1024) / 1024).toFixed(1)} GB · Network
            isolated
          </span>
        </span>
        <span>
          {runtime.expiresAt && ready
            ? `Runtime expires ${new Date(runtime.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Saved files stay in CodeSkill"}
          <span className="ml-4 hidden lg:inline">
            {projectLanguage(activePath)} · UTF-8
          </span>
        </span>
      </footer>
      <LabsModal
        open={fileDialog === "delete"}
        onClose={() => setFileDialog(null)}
        title={`Delete ${fileTarget.folder ? "folder" : "file"}?`}
        description={`Remove ${fileTarget.path}${fileTarget.folder ? " and everything inside it" : ""} from your project?`}
      >
        <form onSubmit={fileAction} className="space-y-4">
          {fileError && (
            <p role="alert" className="text-xs text-destructive">
              {fileError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={labsAction}
              onClick={() => setFileDialog(null)}
            >
              Cancel
            </button>
            <button
              className={`${labsPrimary} ${fileDialog === "delete" ? "border-destructive bg-destructive text-white hover:bg-destructive/90" : ""}`}
            >
              {fileDialog === "delete"
                ? `Delete ${fileTarget.folder ? "folder" : "file"}`
                : fileDialog === "rename"
                  ? "Rename"
                  : fileDialog === "new-folder"
                    ? "Create folder"
                    : "Create file"}
            </button>
          </div>
        </form>
      </LabsModal>
    </div>
  );
}
