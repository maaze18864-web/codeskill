"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ClipboardList, Code2 } from "lucide-react";
import { studentLabsAPI } from "@/config/api";
import type { LabWorkspaceProblem } from "@/lib/lab-workspace";
import type { LabAssessmentSummary } from "@/lib/labs-types";
import { labsAction, labsPanel, LabsTable, labsError } from "./LabsUI";
import { Spinner } from "@/components/ui/spinner";
interface Data {
  lab?: { title?: string };
  experiment?: { title?: string; description?: string };
  problems?: LabWorkspaceProblem[];
  assessments?: LabAssessmentSummary[];
}
export function LabExperimentOverview({
  labId,
  experimentId,
  teacher = false,
  loadWorkspace,
}: {
  labId: string;
  experimentId: string;
  teacher?: boolean;
  loadWorkspace: (
    labId: string,
    experimentId: string,
  ) => Promise<{ data: Data }>;
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [opening, setOpening] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let live = true;
    loadWorkspace(labId, experimentId)
      .then((response) => {
        if (live) setData(response.data);
      })
      .catch(() => {
        if (live) setError("Could not load this experiment.");
      });
    return () => {
      live = false;
    };
  }, [labId, experimentId, loadWorkspace]);
  const root = `${teacher ? "/teacher" : ""}/labs/${labId}`;
  const practice = data?.problems || [],
    assessments = data?.assessments || [];
  const practiceMarks = practice.reduce((sum, item) => sum + item.maxScore, 0),
    examMarks = assessments.reduce((sum, item) => sum + item.maxScore, 0);
  async function openProject(id: string) {
    if (opening) return;
    setOpening(true);
    try {
      const { data } = await studentLabsAPI.openProject(
        labId,
        experimentId,
        id,
      );
      router.push(`/projects/${data.project.id}`);
    } catch (error) {
      setError(labsError(error, "Could not open project."));
    } finally {
      setOpening(false);
    }
  }
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-16 items-center gap-4 border-b border-border bg-card px-6">
        <Link href={root} className={labsAction}>
          <ArrowLeft className="size-4" />
          {data?.lab?.title || "Back to lab"}
        </Link>
        <span className="text-sm text-muted-foreground">
          Experiment overview
        </span>
      </header>
      <main className="mx-auto max-w-6xl space-y-7 px-6 py-8">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!data && !error ? (
          <Spinner />
        ) : (
          data && (
            <>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {data.experiment?.title}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {data.experiment?.description}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Practice marks", practiceMarks],
                  ["Assessment marks", examMarks],
                  ["Total", practiceMarks + examMarks],
                ].map(([label, value]) => (
                  <div key={label} className={`${labsPanel} px-5 py-4`}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Code2 className="size-4" />
                  Practice questions
                </h2>
                <LabsTable label="Experiment practice questions">
                  <thead>
                    <tr>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Marks</th>
                      <th>Progress</th>
                      <th>
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {practice.map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.title}</td>
                        <td>
                          {item.kind === "sql"
                            ? "SQL"
                            : item.kind === "project"
                              ? "Project"
                              : "Coding"}
                        </td>
                        <td className="tabular-nums">
                          {item.progress?.score ?? 0} / {item.maxScore}
                        </td>
                        <td className="capitalize text-muted-foreground">
                          {(item.progress?.status || "not_started").replaceAll(
                            "_",
                            " ",
                          )}
                        </td>
                        <td className="text-right">
                          {item.kind === "project" ? (
                            <button
                              disabled={opening}
                              className={labsAction}
                              onClick={() => openProject(item.id)}
                            >
                              Open project
                              <ArrowUpRight className="size-3.5" />
                            </button>
                          ) : (
                            <Link
                              className={labsAction}
                              href={`${root}/experiments/${experimentId}/practice/${item.id}`}
                            >
                              Practice
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!practice.length && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No practice questions published.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </LabsTable>
              </section>
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <ClipboardList className="size-4" />
                  Experiment assessments
                </h2>
                <p className="text-xs leading-5 text-muted-foreground">
                  Each assessment contains multiple questions and uses the
                  standard assessment environment. Lab marks are proportional to
                  your best completed assessment score.
                </p>
                <LabsTable label="Experiment assessments">
                  <thead>
                    <tr>
                      <th>Assessment</th>
                      <th>Questions</th>
                      <th>Duration</th>
                      <th>Exam marks</th>
                      <th>Lab marks</th>
                      <th>
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold">{item.title}</td>
                        <td>{item.questionCount}</td>
                        <td>{item.durationMinutes} min</td>
                        <td>{item.totalMarks}</td>
                        <td>
                          {item.earnedScore ?? "—"} / {item.maxScore}
                        </td>
                        <td className="text-right">
                          {teacher ? (
                            <span className="text-xs text-muted-foreground">
                              Student assessment
                            </span>
                          ) : (
                            <Link
                              href={`/assessments/${item.id}`}
                              className={labsAction}
                            >
                              Open assessment
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!assessments.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No assessments published for this experiment yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </LabsTable>
              </section>
            </>
          )
        )}
      </main>
    </div>
  );
}
