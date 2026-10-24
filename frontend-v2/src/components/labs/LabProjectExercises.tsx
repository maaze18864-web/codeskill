"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Code2,
  FolderCode,
  Loader2,
} from "lucide-react";
import { studentLabsAPI } from "@/config/api";
import { TechnologyIcon } from "@/components/projects/TechnologyPicker";
import type { LabWorkspaceProblem } from "@/lib/lab-workspace";
import { labsAction, labsError } from "./LabsUI";

export function LabProjectExercises({
  labId,
  experimentId,
  title,
  labTitle,
  problems,
  backHref,
  onOpenCoding,
}: {
  labId: string;
  experimentId: string;
  title: string;
  labTitle: string;
  problems: LabWorkspaceProblem[];
  backHref: string;
  onOpenCoding: (problem: LabWorkspaceProblem) => void;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function open(problem: LabWorkspaceProblem) {
    if (problem.kind !== "project") {
      onOpenCoding(problem);
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setOpening(problem.id);
    setError("");
    try {
      const { data } = await studentLabsAPI.openProject(
        labId,
        experimentId,
        problem.id,
      );
      router.push(`/projects/${data.project.id}`);
    } catch (error) {
      setError(labsError(error, "Could not open your project exercise."));
    } finally {
      pending.current = false;
      setOpening(null);
    }
  }
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-16 items-center gap-3 border-b border-border bg-card px-6">
        <Link href={backHref} className={labsAction}>
          <ArrowLeft className="size-4" />
          {labTitle}
        </Link>
        <span className="truncate text-sm text-muted-foreground">{title}</span>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            Experiment
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Complete the missing code in each starter project. Your files save
            to your own workspace; use the preview and API client to verify the
            behavior.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {problems.map((problem, index) => (
            <article
              key={problem.id}
              className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {problem.kind === "project" ? (
                  <FolderCode className="size-5" />
                ) : (
                  <Code2 className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Exercise {index + 1} ·{" "}
                  {problem.kind === "project" ? "Project" : "Coding"} ·{" "}
                  {problem.difficulty}
                </p>
                <h2 className="mt-1 text-base font-semibold">
                  {problem.title}
                </h2>
                {problem.project && (
                  <>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                      {problem.project.instructions}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      {[
                        problem.project.frontendStack,
                        problem.project.backendStack,
                      ]
                        .filter(Boolean)
                        .map((stack) => (
                          <TechnologyIcon key={stack} id={stack!} size={18} />
                        ))}
                      <span className="text-xs text-muted-foreground">
                        {problem.project.fileCount} starter files ·{" "}
                        {problem.progress?.status === "in_progress"
                          ? "In progress"
                          : "Ready to start"}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <button
                className={labsAction}
                disabled={opening !== null}
                onClick={() => open(problem)}
              >
                {opening === problem.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
                {problem.kind === "project"
                  ? problem.progress?.status === "in_progress"
                    ? "Continue project"
                    : "Open project"
                  : "Open problem"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
