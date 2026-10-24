"use client";
import { useEffect, useState } from "react";
import { projectsAPI } from "@/config/api";
import { ProjectCodeEditor } from "@/components/projects/ProjectCodeEditor";
import { TechnologyPicker } from "@/components/projects/TechnologyPicker";
import { useTheme } from "@/context/ThemeContext";
import {
  validProjectPath,
  type Project,
  type ProjectCatalog,
} from "@/lib/project-workspace";
import type { LabProjectTemplate } from "@/lib/labs-types";
import {
  LabsModal,
  labsAction,
  labsControl,
  labsPrimary,
  labsError,
} from "./LabsUI";

export function LabProjectAuthor({
  initial,
  onClose,
  onSave,
}: {
  initial?: LabProjectTemplate;
  onClose: () => void;
  onSave: (template: LabProjectTemplate) => Promise<void>;
}) {
  const { resolvedTheme } = useTheme();
  const [draft, setDraft] = useState<LabProjectTemplate>(
    initial || {
      name: "",
      instructions: "",
      mode: "fullstack",
      frontendStack: "react",
      backendStack: "express",
      files: [],
      maxScore: 10,
      difficulty: "Medium",
    },
  );
  const [catalog, setCatalog] = useState<ProjectCatalog | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [source, setSource] = useState("");
  const [activePath, setActivePath] = useState(initial?.files[0]?.path || "");
  const [pathName, setPathName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([projectsAPI.catalog(), projectsAPI.list()])
      .then(([catalog, list]) => {
        if (live) {
          setCatalog(catalog.data.catalog);
          setProjects(list.data.projects || []);
        }
      })
      .catch(() => {
        if (live)
          setError(
            "Could not load project sources. You can still edit an existing starter.",
          );
      });
    return () => {
      live = false;
    };
  }, []);
  const active = draft.files.find((file) => file.path === activePath);
  async function loadSource() {
    setBusy(true);
    setError("");
    try {
      const project = source
        ? ((await projectsAPI.get(source)).data.project as Project)
        : ((
            await projectsAPI.template({
              ...draft,
              name: draft.name.trim() || "Lab project",
            })
          ).data.template as Project);
      setDraft((current) => ({
        ...current,
        mode: project.mode,
        frontendStack: project.frontendStack || undefined,
        backendStack: project.backendStack || undefined,
        files: project.files,
        directories: project.directories || [],
      }));
      setActivePath(project.files[0]?.path || "");
    } catch (error) {
      setError(labsError(error, "Could not load the starter."));
    } finally {
      setBusy(false);
    }
  }
  function savePath() {
    const path = pathName.trim();
    if (!validProjectPath(path, draft.files, adding ? undefined : activePath)) {
      setError("Choose a unique relative file path.");
      return;
    }
    setDraft((current) => ({
      ...current,
      files: adding
        ? [...current.files, { path, content: "" }]
        : current.files.map((file) =>
            file.path === activePath ? { ...file, path } : file,
          ),
    }));
    setActivePath(path);
    setPathName("");
    setAdding(false);
    setError("");
  }
  return (
    <LabsModal
      open
      onClose={onClose}
      busy={busy}
      wide
      title={initial ? "Edit project exercise" : "Add project exercise"}
      description="Provide a complete starter project, then replace the parts students must implement with TODO comments. Each student gets an independent copy."
    >
      <form
        className="space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            await onSave(draft);
          } catch (error) {
            setError(labsError(error, "Could not save this project exercise."));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block text-xs font-medium">
          Exercise title
          <input
            required
            maxLength={100}
            className={`${labsControl} mt-2 w-full`}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium">
          Student instructions
          <textarea
            required
            maxLength={12000}
            rows={5}
            className={`${labsControl} mt-2 h-auto w-full py-2 leading-6`}
            placeholder="Describe the missing functionality, files to edit, expected behavior, and how to test it."
            value={draft.instructions}
            onChange={(e) =>
              setDraft({ ...draft, instructions: e.target.value })
            }
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-medium">
            Project type
            <select
              className={`${labsControl} mt-2 w-full`}
              value={draft.mode}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  mode: e.target.value as LabProjectTemplate["mode"],
                  frontendStack: draft.frontendStack || "react",
                  backendStack: draft.backendStack || "express",
                })
              }
            >
              <option value="fullstack">Fullstack</option>
              <option value="frontend">Frontend</option>
              <option value="backend">Backend</option>
            </select>
          </label>
          <label className="text-xs font-medium">
            Difficulty
            <select
              className={`${labsControl} mt-2 w-full`}
              value={draft.difficulty}
              onChange={(e) =>
                setDraft({ ...draft, difficulty: e.target.value })
              }
            >
              {["Easy", "Medium", "Hard"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Maximum score
            <input
              type="number"
              min={0}
              max={10000}
              className={`${labsControl} mt-2 w-full`}
              value={draft.maxScore ?? 10}
              onChange={(e) =>
                setDraft({ ...draft, maxScore: Number(e.target.value) })
              }
            />
          </label>
        </div>
        {catalog && (
          <div className="grid gap-5 md:grid-cols-2">
            {draft.mode !== "backend" && (
              <TechnologyPicker
                kind="frontend"
                stacks={catalog.frontend}
                value={draft.frontendStack || "react"}
                onChange={(frontendStack) =>
                  setDraft({ ...draft, frontendStack })
                }
              />
            )}
            {draft.mode !== "frontend" && (
              <TechnologyPicker
                kind="backend"
                stacks={catalog.backend}
                value={draft.backendStack || "express"}
                onChange={(backendStack) =>
                  setDraft({ ...draft, backendStack })
                }
              />
            )}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/25 p-3">
          <label className="min-w-48 flex-1 text-xs font-medium">
            Starter source
            <select
              className={`${labsControl} mt-2 w-full`}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Generate starter for selected stack</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={labsAction}
            disabled={busy || (!catalog && !source)}
            onClick={loadSource}
          >
            {draft.files.length
              ? "Replace starter files"
              : "Load starter files"}
          </button>
          <p className="w-full text-[11px] leading-5 text-muted-foreground">
            Import a prepared project or generate a starter, then edit its
            missing sections below. Loading a source replaces this form’s files.
            Existing student copies stay unchanged.
          </p>
        </div>
        {!!draft.files.length && (
          <div className="grid h-[460px] grid-cols-[180px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border">
            <div className="overflow-auto border-r border-border bg-muted/20 p-2">
              <button
                type="button"
                className={`${labsAction} mb-2 w-full`}
                onClick={() => {
                  setAdding(true);
                  setPathName("");
                }}
              >
                New file
              </button>
              {(adding || pathName) && (
                <input
                  autoFocus
                  aria-label="Exercise file path"
                  placeholder="src/file.js"
                  className={`${labsControl} mb-2 h-8 w-full text-xs`}
                  value={pathName}
                  onChange={(e) => setPathName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      savePath();
                    }
                    if (e.key === "Escape") {
                      setAdding(false);
                      setPathName("");
                    }
                  }}
                />
              )}
              {draft.files.map((file) => (
                <button
                  type="button"
                  key={file.path}
                  title={file.path}
                  className={`block w-full truncate rounded px-2 py-2 text-left text-[11px] ${activePath === file.path ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                  onClick={() => {
                    setActivePath(file.path);
                    setAdding(false);
                    setPathName("");
                  }}
                >
                  {file.path}
                </button>
              ))}
            </div>
            {active && (
              <ProjectCodeEditor
                path={active.path}
                value={active.content}
                theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                onChange={(content) =>
                  setDraft((current) => ({
                    ...current,
                    files: current.files.map((file) =>
                      file.path === activePath
                        ? { ...file, content: content || "" }
                        : file,
                    ),
                  }))
                }
                onRename={() => {
                  setAdding(false);
                  setPathName(active.path);
                }}
                onDelete={() => {
                  if (draft.files.length === 1) {
                    setError("Keep at least one starter file.");
                    return;
                  }
                  setDraft((current) => ({
                    ...current,
                    files: current.files.filter(
                      (file) => file.path !== activePath,
                    ),
                  }));
                  setActivePath(
                    draft.files.find((file) => file.path !== activePath)
                      ?.path || "",
                  );
                }}
              />
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={labsAction}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={labsPrimary}
            disabled={
              busy ||
              !draft.files.length ||
              !draft.name.trim() ||
              !draft.instructions.trim()
            }
          >
            {busy ? "Saving…" : "Save project exercise"}
          </button>
        </div>
      </form>
    </LabsModal>
  );
}
