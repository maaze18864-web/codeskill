"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Editor from "@monaco-editor/react";
import {
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock3,
  Code2,
  FlaskConical,
  Moon,
  Play,
  Send,
  Sun,
} from "lucide-react";
import { runAPI, studentLabsAPI, submissionAPI } from "@/config/api";
import { awaitExecution } from "@/lib/await-execution";
import {
  awaitSubmission,
  type ExecutionFeedbackResult,
} from "@/lib/submission-feedback";
import {
  LAB_LANGUAGES,
  labDefaultLanguage,
  labLanguages,
  labRunRequest,
  labStarterCode,
  type LabWorkspaceProblem,
} from "@/lib/lab-workspace";
import { useTheme } from "@/context/ThemeContext";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import ExecutionFeedback from "@/components/Result/ExecutionFeedback";
import { ProblemText } from "./ProblemText";
import { LabProjectExercises } from "./LabProjectExercises";
import { SqlQuestionEditor } from "@/components/sql/SqlQuestionEditor";

interface WorkspaceData {
  lab?: { title?: string };
  experiment?: { title?: string };
  problems?: LabWorkspaceProblem[];
}
interface Props {
  initialProblemId?: string;
  labId: string;
  experimentId: string;
  backHref: string;
  loadWorkspace: (
    labId: string,
    experimentId: string,
  ) => Promise<{ data: WorkspaceData }>;
  recordProgress?: (
    labId: string,
    data: Record<string, unknown>,
  ) => Promise<{ data: LabWorkspaceProblem["progress"] }>;
}

function errorMessage(error: unknown) {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  return Array.isArray(message)
    ? message.join(". ")
    : message ||
        (error instanceof Error
          ? error.message
          : "Execution could not be completed. Please try again.");
}

export function LabExperimentWorkspace({
  labId,
  experimentId,
  backHref,
  loadWorkspace,
  recordProgress = studentLabsAPI.recordProgress,
  initialProblemId,
}: Props) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData>({});
  const [showProjectExercises, setShowProjectExercises] =
    useState(!initialProblemId);
  const [problems, setProblems] = useState<LabWorkspaceProblem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [language, setLanguage] = useState("c");
  const [code, setCode] = useState("");
  const [rightTab, setRightTab] = useState<"problem" | "test" | "submit">(
    "problem",
  );
  const [operation, setOperation] = useState<"run" | "submission" | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<"run" | "submission">("run");
  const [phase, setPhase] = useState<string | null>(null);
  const [result, setResult] = useState<ExecutionFeedbackResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [progressWarning, setProgressWarning] = useState<string | null>(null);
  const [runtimes, setRuntimes] = useState<
    Array<{ language: string; enabled: boolean }>
  >([]);
  const [spentSeconds, setSpentSeconds] = useState(0);
  const drafts = useRef<Record<string, string>>({});
  const alive = useRef(true);
  const inFlight = useRef(false);
  const lastReportedAt = useRef(Date.now());
  const startedAt = useRef(Date.now());

  useEffect(() => {
    alive.current = true;
    const timer = setInterval(
      () =>
        setSpentSeconds(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadWorkspace(labId, experimentId)
      .then(({ data }) => {
        if (cancelled) return;
        const list = data.problems || [];
        setWorkspace(data);
        setProblems(list);
        const first =
          list.find((problem) => problem.id === initialProblemId) ||
          list.find((problem) => problem.kind !== "project");
        if (first) {
          const selected = labDefaultLanguage(first);
          setActiveId(first.id);
          setLanguage(selected);
          setCode(
            drafts.current[`${first.id}:${selected}`] ??
              labStarterCode(first, selected),
          );
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load this experiment. Please return to your lab and try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labId, experimentId, loadWorkspace, initialProblemId]);

  useEffect(() => {
    let cancelled = false;
    runAPI
      .runtimes()
      .then(({ data }) => {
        if (!cancelled)
          setRuntimes(
            Array.isArray(data)
              ? data
              : (data as { data?: typeof runtimes }).data || [],
          );
      })
      .catch(() => {
        /* Keep authored language choices available during a temporary discovery failure. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => problems.find((problem) => problem.id === activeId) || null,
    [problems, activeId],
  );
  const choices = labLanguages(active, runtimes);
  const busy = operation !== null;
  const canExecute =
    !!active && choices.some((choice) => choice.id === language);
  const langMeta =
    LAB_LANGUAGES.find((choice) => choice.id === language) || LAB_LANGUAGES[0];
  const solvedCount = problems.filter(
    (problem) => problem.progress?.status === "solved",
  ).length;
  const panelMode = rightTab === "submit" ? "submission" : "run";
  const matchesFeedback = panelMode === feedbackMode;

  function resetFeedback() {
    setResult(null);
    setActionError(null);
    setProgressWarning(null);
  }

  function selectProblem(problem: LabWorkspaceProblem) {
    if (busy) return;
    if (problem.kind === "project") {
      setShowProjectExercises(true);
      return;
    }
    const selected = labDefaultLanguage(problem);
    setActiveId(problem.id);
    setLanguage(selected);
    setCode(
      drafts.current[`${problem.id}:${selected}`] ??
        labStarterCode(problem, selected),
    );
    setRightTab("problem");
    lastReportedAt.current = Date.now();
    resetFeedback();
  }

  function changeLanguage(selected: string) {
    if (!active || busy) return;
    setLanguage(selected);
    setCode(
      drafts.current[`${active.id}:${selected}`] ??
        labStarterCode(active, selected),
    );
    resetFeedback();
  }

  async function execute(mode: "run" | "submission") {
    if (!active?.problemMetadataId || !canExecute || inFlight.current) return;
    inFlight.current = true;
    setOperation(mode);
    setFeedbackMode(mode);
    setRightTab(mode === "run" ? "test" : "submit");
    setPhase("queued");
    resetFeedback();
    try {
      let submissionId: string | undefined;
      let feedback: ExecutionFeedbackResult;
      if (mode === "run") {
        const request = labRunRequest(active, code, language);
        const response = await awaitExecution(
          () => runAPI.run(request),
          async (jobId) => {
            if (!alive.current) throw new Error("Workspace closed");
            const update = await runAPI.getJob(jobId);
            if (alive.current && update.data.status === "active")
              setPhase("running");
            return update;
          },
        );
        const data = response.data;
        feedback = {
          ...data,
          results: (data.results || []).map(
            (
              test: ExecutionFeedbackResult["results"][number],
              index: number,
            ) => ({
              ...test,
              input: test.input ?? request.testCases[index]?.input,
              expected: test.expected ?? request.testCases[index]?.expected,
            }),
          ),
          passedCount: data.passedCount ?? 0,
          totalCount: data.totalCount ?? request.testCases.length,
        };
      } else {
        feedback = await awaitSubmission(
          async () => {
            const response = await submissionAPI.submit({
              problemId: active.problemMetadataId,
              code,
              language,
            });
            submissionId = response.data.submissionId;
            return response;
          },
          (id) => {
            if (!alive.current) throw new Error("Workspace closed");
            return submissionAPI.getResult(id);
          },
          (status) => {
            if (alive.current) setPhase(status);
          },
        );
      }
      if (!alive.current) return;
      setResult(feedback);
      setPhase(null);
      const reportedAt = Date.now();
      try {
        const saved = await recordProgress(labId, {
          experimentProblemId: active.id,
          status:
            active.progress?.status === "solved" ||
            (mode === "submission" && feedback.status === "accepted")
              ? "solved"
              : mode === "submission"
                ? "failed"
                : "in_progress",
          ...(submissionId ? { submissionId } : {}),
          timeSpentSeconds: Math.max(
            0,
            Math.floor((reportedAt - lastReportedAt.current) / 1000),
          ),
        });
        if (!alive.current) return;
        lastReportedAt.current = reportedAt;
        setProblems((list) =>
          list.map((problem) =>
            problem.id === active.id
              ? { ...problem, progress: saved.data }
              : problem,
          ),
        );
      } catch {
        if (alive.current)
          setProgressWarning(
            "Your execution finished, but progress could not be saved. Your code is still in the editor.",
          );
      }
    } catch (error) {
      if (alive.current) setActionError(errorMessage(error));
    } finally {
      inFlight.current = false;
      if (alive.current) {
        setOperation(null);
        setPhase(null);
      }
    }
  }

  if (loading)
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Spinner aria-label="Loading experiment" />
      </div>
    );
  if (error)
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Link href={backHref} className="text-sm text-primary hover:underline">
          Back to lab
        </Link>
      </div>
    );

  if (active?.kind === "sql" && active.sql)
    return (
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
          <Link href={backHref} className="text-xs font-semibold text-primary">
            ← Back to experiment
          </Link>
          <h1 className="text-sm font-semibold">
            {workspace.experiment?.title}
          </h1>
        </header>
        <div className="flex min-h-0 flex-1">
          <aside className="w-48 shrink-0 space-y-1 overflow-auto border-r border-border bg-card p-3">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Practice questions
            </h2>
            {problems.map((problem) => (
              <button
                key={problem.id}
                className={`block w-full rounded-lg p-3 text-left text-xs ${problem.id === activeId ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                onClick={() => selectProblem(problem)}
              >
                {problem.title}
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {problem.maxScore} marks
                </span>
              </button>
            ))}
          </aside>
          <div className="flex min-w-0 flex-1 p-3">
            <SqlQuestionEditor
              key={active.id}
              problem={active.sql}
              initialCode={
                drafts.current[`${active.id}:sql`] ?? active.progress?.lastCode
              }
              marks={active.maxScore}
              onDraftChange={(value) => {
                drafts.current[`${active.id}:sql`] = value;
              }}
              execute={async (value, submit) =>
                (
                  await studentLabsAPI.executeSql(
                    labId,
                    experimentId,
                    active.id,
                    value,
                    submit,
                  )
                ).data
              }
            />
          </div>
        </div>
      </div>
    );

  if (
    showProjectExercises &&
    problems.some((problem) => problem.kind === "project")
  )
    return (
      <LabProjectExercises
        labId={labId}
        experimentId={experimentId}
        title={workspace.experiment?.title || "Project experiment"}
        labTitle={workspace.lab?.title || "Lab"}
        problems={problems}
        backHref={backHref}
        onOpenCoding={(problem) => {
          selectProblem(problem);
          setShowProjectExercises(false);
        }}
      />
    );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors hover:text-primary"
          >
            <ChevronLeft className="size-4" />
            {workspace.lab?.title || "Lab"}
          </Link>
          <span className="text-border">/</span>
          <span className="truncate text-sm text-muted-foreground">
            {workspace.experiment?.title || "Experiment"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {problems.some((problem) => problem.kind === "project") && (
            <button
              className="text-xs text-primary"
              onClick={() => setShowProjectExercises(true)}
            >
              All exercises
            </button>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <Clock3 className="size-3.5" />
            {Math.floor(spentSeconds / 60)}m spent
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[200px_minmax(0,1fr)_360px] lg:overflow-hidden xl:grid-cols-[216px_minmax(0,1fr)_400px]">
        <aside
          aria-label="Experiment problems"
          className="flex flex-col border-r border-border bg-card lg:min-h-0"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Problems
            </h2>
            <span className="rounded-md bg-muted px-2 py-1 text-[11px] tabular-nums text-muted-foreground">
              {solvedCount}/{problems.length}
            </span>
          </div>
          <ul className="overflow-y-auto p-2">
            {problems.map((problem, index) => (
              <li key={problem.id} className="mb-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => selectProblem(problem)}
                  aria-current={problem.id === activeId ? "true" : undefined}
                  className={`flex w-full items-start gap-2 rounded-lg border px-3 py-3 text-left text-sm transition-colors disabled:opacity-60 ${problem.id === activeId ? "border-primary/25 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                >
                  <span className="mt-0.5 text-xs tabular-nums">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 flex-1 font-medium leading-5">
                    {problem.title}
                  </span>
                  {problem.progress?.status === "solved" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 opacity-50" />
                  )}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-auto hidden border-t border-border px-4 py-4 text-[11px] leading-5 text-muted-foreground lg:block">
            Run examples to check your approach. Submit to evaluate all test
            cases.
          </p>
        </aside>

        <main
          aria-label="Code editor"
          className="flex min-h-[420px] min-w-0 flex-col border-r border-border bg-card lg:min-h-0"
        >
          <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Code2 className="size-4" />
              {langMeta.file}
            </span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Code language"
                disabled={busy}
                className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={language}
                onChange={(event) => changeLanguage(event.target.value)}
              >
                {choices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !canExecute}
                onClick={() => execute("run")}
              >
                <Play className="size-3.5" />
                {operation === "run" ? "Running…" : "Run"}
              </Button>
              <Button
                size="sm"
                disabled={busy || !canExecute}
                onClick={() => execute("submission")}
              >
                <Send className="size-3.5" />
                {operation === "submission" ? "Judging…" : "Submit"}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            {active ? (
              <Editor
                height="100%"
                language={language}
                theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                value={code}
                onChange={(value) => {
                  const next = value || "";
                  drafts.current[`${active.id}:${language}`] = next;
                  setCode(next);
                }}
                options={{
                  fontSize: 14,
                  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 18, bottom: 18 },
                  readOnly: busy,
                  tabSize: 4,
                }}
              />
            ) : (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
                <FlaskConical className="size-7" />
                <p className="text-sm">
                  No problems have been added to this experiment yet.
                </p>
              </div>
            )}
          </div>
        </main>

        <aside
          aria-label="Problem and results"
          className="flex min-h-80 flex-col bg-card lg:min-h-0"
        >
          <div
            role="tablist"
            aria-label="Workspace panels"
            className="flex h-14 shrink-0 border-b border-border"
          >
            {(
              [
                ["problem", "Problem"],
                ["test", "Test output"],
                ["submit", "Submission"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                id={`lab-tab-${tab}`}
                role="tab"
                aria-selected={rightTab === tab}
                aria-controls="lab-panel"
                type="button"
                onClick={() => setRightTab(tab)}
                className={`flex-1 border-b-2 px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${rightTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            id="lab-panel"
            role="tabpanel"
            aria-labelledby={`lab-tab-${rightTab}`}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5"
          >
            {rightTab === "problem" && active && (
              <>
                <div>
                  <h1 className="text-xl font-semibold leading-snug tracking-tight">
                    {active.title}
                  </h1>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-md border border-border bg-muted/50 px-2 py-1 text-muted-foreground">
                      {active.difficulty}
                    </span>
                    <span className="rounded-md border border-border bg-muted/50 px-2 py-1 text-muted-foreground">
                      {active.maxScore} points
                    </span>
                    {active.config?.timeLimit && (
                      <span className="rounded-md border border-border bg-muted/50 px-2 py-1 text-muted-foreground">
                        {active.config.timeLimit} ms
                      </span>
                    )}
                  </div>
                </div>
                <ProblemText
                  content={
                    active.statement?.description ||
                    "No problem statement available."
                  }
                />
                {(
                  [
                    ["Input format", active.statement?.inputFormat],
                    ["Output format", active.statement?.outputFormat],
                    ["Constraints", active.statement?.constraints],
                  ] as const
                ).map(([title, content]) =>
                  content ? (
                    <section key={title}>
                      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
                      <ProblemText content={content} />
                    </section>
                  ) : null,
                )}
                {active.statement?.samples?.map((sample, index) => (
                  <section key={index}>
                    <h2 className="mb-3 text-sm font-semibold">
                      Example {index + 1}
                    </h2>
                    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
                      {(
                        [
                          ["Input", sample.input],
                          ["Output", sample.output],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label}>
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            {label}
                          </p>
                          <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-6">
                            {value}
                          </pre>
                        </div>
                      ))}
                    </div>
                    {sample.explanation && (
                      <div className="mt-2">
                        <ProblemText content={sample.explanation} />
                      </div>
                    )}
                  </section>
                ))}
              </>
            )}
            {rightTab !== "problem" && (
              <>
                {actionError && matchesFeedback && (
                  <div
                    role="alert"
                    className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
                  >
                    {actionError}
                  </div>
                )}
                <ExecutionFeedback
                  result={matchesFeedback ? result : null}
                  phase={matchesFeedback ? phase : null}
                  mode={panelMode}
                  context="practice"
                  language={langMeta.name}
                />
                {progressWarning && matchesFeedback && (
                  <p
                    role="status"
                    className="text-xs leading-5 text-muted-foreground"
                  >
                    {progressWarning}
                  </p>
                )}
              </>
            )}
            {!active && (
              <p className="text-sm text-muted-foreground">
                Your instructor will add problems here.
              </p>
            )}
            {active && !canExecute && (
              <p role="status" className="text-xs text-destructive">
                No execution runtime is currently available for the selected
                language.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
