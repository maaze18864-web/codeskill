"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Save,
  Trash2,
  Settings,
  Code2,
  Cpu,
  FileText,
  AlertTriangle,
  ArrowRightLeft,
  LayoutTemplate,
  Shield,
  Database,
  Rocket,
} from "lucide-react";
import { adminProblemsAPI, adminQuestionsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import { createQuestionStore } from "@/app/admin/questions/create/_store/useQuestionStore";
import {
  QuestionEditorProvider,
  useQuestionEditorStore,
} from "@/app/admin/questions/create/_store/QuestionEditorProvider";
import BasicInfo from "@/app/admin/questions/create/_components/BasicInfo";
import ProgrammingLanguages from "@/app/admin/questions/create/_components/ProgrammingLanguages";
import ExecutionSettings from "@/app/admin/questions/create/_components/ExecutionSettings";
import ProblemStatement from "@/app/admin/questions/create/_components/ProblemStatement";
import Constraints from "@/app/admin/questions/create/_components/Constraints";
import InputOutputFormat from "@/app/admin/questions/create/_components/InputOutputFormat";
import StarterCode from "@/app/admin/questions/create/_components/StarterCode";
import ReferenceSolution from "@/app/admin/questions/create/_components/ReferenceSolution";
import TestCases from "@/app/admin/questions/create/_components/TestCases";
import SectionCard from "@/app/admin/questions/create/_components/SectionCard";
import {
  practiceDraft,
  practicePayload,
  validatePracticeDraft,
  type PracticeAuthoringRecord,
} from "@/lib/practice-problem-editor";

const sections = [
  { id: "basic-info", label: "Basic Info", icon: Settings },
  { id: "languages", label: "Languages", icon: Code2 },
  { id: "execution-settings", label: "Execution", icon: Cpu },
  { id: "statement", label: "Statement", icon: FileText },
  { id: "constraints", label: "Constraints", icon: AlertTriangle },
  { id: "io-format", label: "I/O Format", icon: ArrowRightLeft },
  { id: "starter-code", label: "Starter Code", icon: LayoutTemplate },
  { id: "reference-solution", label: "Reference", icon: Shield },
  { id: "test-cases", label: "Test Cases", icon: Database },
  { id: "publishing", label: "Publishing", icon: Rocket },
];

export default function PracticeProblemEditor({
  problemId,
}: {
  problemId?: string;
}) {
  return (
    <Suspense fallback={<Loading />}>
      <EditorRoute problemId={problemId} />
    </Suspense>
  );
}

function EditorRoute({ problemId }: { problemId?: string }) {
  const searchParams = useSearchParams();
  const fromQuestion = !problemId ? searchParams.get("fromQuestion") : null;
  return (
    <EditorSession
      key={`${problemId ?? "new"}:${fromQuestion ?? ""}`}
      problemId={problemId}
      fromQuestion={fromQuestion}
    />
  );
}

interface EditorProps {
  problemId?: string;
  fromQuestion: string | null;
}

function EditorSession(props: EditorProps) {
  const [store] = useState(createQuestionStore);
  return (
    <QuestionEditorProvider store={store}>
      <Editor {...props} />
    </QuestionEditorProvider>
  );
}

function Loading() {
  return (
    <div
      role="status"
      className="flex justify-center items-center gap-3 p-16 text-muted-foreground"
    >
      <Spinner className="h-5 w-5" /> Loading problem details…
    </div>
  );
}

function Editor({ problemId, fromQuestion }: EditorProps) {
  const router = useRouter();
  const store = useQuestionEditorStore();
  const {
    setAllData,
    metadata,
    updateMetadata,
    activeSection,
    setActiveSection,
  } = store;
  const [fetching, setFetching] = useState(Boolean(problemId || fromQuestion));
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [source, setSource] = useState<PracticeAuthoringRecord>();
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!problemId && !fromQuestion) return;
    let cancelled = false;
    const request = problemId
      ? adminProblemsAPI.getById(problemId)
      : adminQuestionsAPI.getById(fromQuestion!);
    request
      .then((response) => {
        if (cancelled) return;
        const record =
          response.data?.problem ?? response.data?.data ?? response.data;
        if (!record || typeof record !== "object" || !(record.id || record._id))
          throw new Error("The problem record could not be loaded.");
        setAllData(practiceDraft(record, Boolean(fromQuestion)));
        setSource(record);
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(errorMessage(err, "Unable to load this problem."));
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [problemId, fromQuestion, setAllData, retry]);

  useEffect(() => {
    if (fetching || loadError || typeof IntersectionObserver === "undefined")
      return;
    const form = formRef.current;
    if (!form) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { root: form.closest("main"), rootMargin: "-100px 0px -50% 0px" },
    );
    sections.forEach(({ id }) => {
      const element = form.querySelector(`[id="${id}"]`);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [fetching, loadError, setActiveSection]);

  const save = async (visibility: "Draft" | "Published" | "Private") => {
    if (saving || deleting || fetching || loadError) return;
    const validationError = validatePracticeDraft(store, visibility);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = practicePayload(store, visibility, source);
      if (problemId) await adminProblemsAPI.update(problemId, payload);
      else await adminProblemsAPI.create(payload);
      router.push("/admin/problems");
    } catch (err) {
      setError(errorMessage(err, "Unable to save this problem."));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (
      !problemId ||
      !window.confirm(
        `Permanently delete practice problem "${metadata.title}"?`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await adminProblemsAPI.delete(problemId);
      router.push("/admin/problems");
    } catch (err) {
      setError(errorMessage(err, "Unable to delete this problem."));
      setDeleting(false);
    }
  };

  if (fetching) return <Loading />;
  if (loadError)
    return (
      <div className="p-8 space-y-4">
        <Link href="/admin/problems" className="text-primary">
          Back to Problems
        </Link>
        <p role="alert">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError("");
            setFetching(true);
            setRetry((value) => value + 1);
          }}
          className="text-primary underline"
        >
          Try again
        </button>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/problems"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Practice Problems
            </Link>
            <span className="text-border">/</span>
            <h1 className="text-sm font-semibold">
              {problemId ? "Edit Practice Problem" : "Create Practice Problem"}
            </h1>
          </div>
          {!problemId && (
            <Link
              href="/admin/problems/import"
              onClick={(event) => {
                if (
                  (metadata.title ||
                    store.statement.description ||
                    store.testCases.length) &&
                  !window.confirm(
                    "Leave this draft and choose a question to import? Unsaved changes will be lost.",
                  )
                )
                  event.preventDefault();
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
            >
              <BookOpen className="h-4 w-4" /> Import from Question Bank
            </Link>
          )}
        </div>
      </header>
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {fromQuestion && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"
          >
            <span className="font-semibold">Imported from Question Bank.</span>{" "}
            Review and edit this practice copy, then save it as a draft or
            publish it. The original question stays unchanged.
          </div>
        )}
        <div className="flex items-start gap-8">
          <aside className="hidden lg:block w-56 shrink-0 sticky top-24">
            <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Sections
            </p>
            <nav className="space-y-0.5" aria-label="Problem sections">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(section.id);
                    formRef.current
                      ?.querySelector(`[id="${section.id}"]`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  aria-current={
                    activeSection === section.id ? "location" : undefined
                  }
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-left ${activeSection === section.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>
          <div className="flex-1 min-w-0 pb-28">
            <form
              ref={formRef}
              onSubmit={(event) => {
                event.preventDefault();
                void save(metadata.visibility);
              }}
              className="max-w-4xl space-y-8 [&>div[id]]:scroll-mt-[100px]"
            >
              {error && (
                <p
                  role="alert"
                  className="sticky top-20 z-30 rounded-xl border border-red-500/20 bg-card p-4 text-sm text-red-500"
                >
                  {error}
                </p>
              )}
              <fieldset
                disabled={saving || deleting}
                className="space-y-8 [&>div[id]]:scroll-mt-[100px]"
              >
                <BasicInfo practice />
              <ProgrammingLanguages showCompilerVersions={false} />
                <ExecutionSettings coreOnly />
                <ProblemStatement />
                <Constraints />
                <InputOutputFormat />
                <StarterCode />
                <ReferenceSolution />
                <TestCases showTools={false} />
                <SectionCard
                  id="publishing"
                  title="Publishing"
                  subtitle="Save privately for review or make this problem available to students."
                  icon={Rocket}
                >
                  <label className="block space-y-2 text-sm font-medium">
                    Visibility
                    <select
                      aria-label="Practice visibility"
                      className="block w-full rounded-xl border border-border bg-background p-3 text-sm"
                      value={metadata.visibility}
                      onChange={(event) =>
                        updateMetadata({
                          visibility: event.target
                            .value as typeof metadata.visibility,
                        })
                      }
                    >
                      <option value="Draft">
                        Draft (hidden from students)
                      </option>
                      <option value="Published">
                        Published (available in practice)
                      </option>
                      {metadata.visibility === "Private" && (
                        <option value="Private">
                          Private (hidden from students)
                        </option>
                      )}
                    </select>
                  </label>
                </SectionCard>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 px-6 py-3 backdrop-blur-xl shadow-lg">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/problems"
              className="text-sm text-muted-foreground"
            >
              Cancel
            </Link>
            {problemId && (
              <button
                type="button"
                onClick={remove}
                disabled={saving || deleting}
                className="inline-flex items-center gap-1.5 text-xs text-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "Deleting…" : "Delete problem"}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => void save("Draft")}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={() => void save(metadata.visibility)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving
                ? "Saving…"
                : metadata.visibility === "Published"
                  ? "Publish Problem"
                  : "Save Problem"}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const message = err.response?.data?.message;
  return Array.isArray(message)
    ? message.join(", ")
    : message || err.message || fallback;
}
