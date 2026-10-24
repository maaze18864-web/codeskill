"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Code2,
  FolderCode,
  Globe,
  Layers,
  Plus,
  Server,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { projectsAPI } from "@/config/api";
import {
  LabsHeader,
  LabsModal,
  LabsNotice,
  labsAction,
  labsControl,
  labsPageWithNavigation,
  labsPrimary,
  labsError,
} from "@/components/labs/LabsUI";
import {
  projectLabsHref,
  type Project,
  type ProjectCatalog,
} from "@/lib/project-workspace";

import {
  TechnologyIcon,
  TechnologyPicker,
  TechnologySummary,
} from "@/components/projects/TechnologyPicker";

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]),
    [catalog, setCatalog] = useState<ProjectCatalog | null>(null);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [name, setName] = useState("My project"),
    [mode, setMode] = useState<Project["mode"]>("fullstack");
  const [frontendStack, setFrontendStack] = useState("react"),
    [backendStack, setBackendStack] = useState("express"),
    [deleting, setDeleting] = useState<Project | null>(null);
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login?redirect=/projects");
  }, [user, authLoading, router]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([projectsAPI.list(), projectsAPI.catalog()])
      .then(([p, c]) => {
        if (active) {
          setProjects(p.data.projects);
          setCatalog(c.data.catalog);
        }
      })
      .catch((e) => {
        if (active) setError(labsError(e, "Could not load projects."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await projectsAPI.create({
        name,
        mode,
        ...(mode !== "backend" ? { frontendStack } : {}),
        ...(mode !== "frontend" ? { backendStack } : {}),
      });
      router.push(`/projects/${data.project.id}`);
    } catch (e) {
      setError(labsError(e, "Could not create project."));
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await projectsAPI.remove(deleting.id);
      setProjects((p) => p.filter((x) => x.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setError(labsError(e, "Could not delete project."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={labsPageWithNavigation}>
      <LabsHeader
        title="Projects"
        backHref={projectLabsHref(user?.role)}
        description="A workspace for building, running, and testing real applications."
      >
        <button
          className={labsPrimary}
          onClick={() => {
            setError("");
            setOpen(true);
          }}
          disabled={!catalog}
        >
          <Plus className="size-4" /> New project
        </button>
      </LabsHeader>
      {error && <LabsNotice>{error}</LabsNotice>}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          [Globe, "Frontend preview", "See your interface as you build."],
          [Server, "API client", "Send requests and inspect responses."],
          [
            Layers,
            "Your stack, your workspace",
            "Combine a frontend and backend of your choice.",
          ],
        ].map(([Icon, title, detail]) => {
          const I = Icon as typeof Globe;
          return (
            <div
              key={String(title)}
              className="flex gap-3 rounded-xl border border-border bg-card p-5"
            >
              <I className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">{String(title)}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {String(detail)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Your workspaces</h2>
          <span className="text-xs text-muted-foreground">
            {projects.length} projects
          </span>
        </div>
        {loading ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            Loading projects…
          </p>
        ) : !projects.length ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <FolderCode className="size-10 text-muted-foreground/50" />
            <h3 className="font-semibold">Your next idea starts here</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Choose a tech stack and get a ready-to-run starter. Files stay
              saved when your sandbox stops.
            </p>
            <button
              onClick={() => setOpen(true)}
              className={labsAction}
              disabled={!catalog}
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Stack</th>
                  <th className="px-5 py-3 font-medium">Last edited</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-border transition-colors hover:bg-muted/30"
                  >
                    <td className="px-5 py-4">
                      <Link
                        className="flex items-center gap-3 font-semibold hover:text-primary"
                        href={`/projects/${p.id}`}
                      >
                        <Code2 className="size-4 text-primary" />
                        {p.name}
                      </Link>
                      <span className="ml-7 text-xs capitalize text-muted-foreground">
                        {p.mode}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs">
                        {p.frontendStack && (
                          <TechnologyIcon id={p.frontendStack} size={14} />
                        )}{" "}
                        {p.backendStack && (
                          <TechnologyIcon id={p.backendStack} size={14} />
                        )}
                        {[p.frontendStack, p.backendStack]
                          .filter(Boolean)
                          .join(" + ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link className={labsAction} href={`/projects/${p.id}`}>
                          Open <ArrowUpRight className="size-3.5" />
                        </Link>
                        <button
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${p.name}`}
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Personal workspaces · Saved files in CodeSkill · Disposable runtimes
        stop after 20 minutes idle or 60 minutes total
      </p>
      <LabsModal
        open={open}
        onClose={() => setOpen(false)}
        title="Create your workspace"
        wide
        description="Pick your application type, then choose the stack you want to build with."
        busy={busy}
      >
        <form onSubmit={create} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 sm:items-end">
            <label className="block text-xs font-medium">
              Project name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className={`${labsControl} mt-2 w-full`}
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-xs font-medium">
                Application type
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {(["frontend", "backend", "fullstack"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={`rounded-lg border p-3 text-sm capitalize transition-colors ${mode === m ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {m === "fullstack" ? "Full stack" : m}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div
            className={`grid gap-6 ${mode === "fullstack" ? "md:grid-cols-2" : ""}`}
          >
            {mode !== "backend" && (
              <TechnologyPicker
                kind="frontend"
                stacks={catalog?.frontend || []}
                value={frontendStack}
                onChange={setFrontendStack}
              />
            )}
            {mode !== "frontend" && (
              <TechnologyPicker
                kind="backend"
                stacks={catalog?.backend || []}
                value={backendStack}
                onChange={setBackendStack}
              />
            )}
          </div>
          <TechnologySummary
            frontend={mode !== "backend" ? frontendStack : undefined}
            backend={mode !== "frontend" ? backendStack : undefined}
          />
          <p className="rounded-lg bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
            Stack dependencies are preinstalled. The isolated runtime has no
            internet access; external package installation is unavailable.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="sticky -bottom-6 -mx-6 flex justify-end gap-2 border-t border-border bg-card px-6 py-4">
            <button
              type="button"
              className={labsAction}
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button className={labsPrimary} disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create workspace"}
            </button>
          </div>
        </form>
      </LabsModal>
      <LabsModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete project?"
        description={`This permanently deletes “${deleting?.name}” and its saved files. Its runtime will be stopped.`}
        busy={busy}
      >
        <div className="flex justify-end gap-2">
          <button
            className={labsAction}
            onClick={() => setDeleting(null)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white"
            onClick={remove}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete project"}
          </button>
        </div>
      </LabsModal>
    </div>
  );
}
