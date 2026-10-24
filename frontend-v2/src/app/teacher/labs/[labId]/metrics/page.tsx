"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { teacherLabsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import {
  LabsHeader,
  LabsNotice,
  LabsTable,
  LabsProgress,
  labsPage,
  labsControl,
} from "@/components/labs/LabsUI";
interface StudentMetric {
  student?: { id: string; name: string; email?: string; uid?: string };
  sectionLabel?: string;
  solvedCount: number;
  totalProblems: number;
  completionPercent: number;
  attempts: number;
  timeSpentSeconds?: number;
  score?: number;
}
interface ClassMetrics {
  lab?: { title: string };
  section?: { code: string };
  enrolledCount: number;
  totalProblems: number;
  experimentCount: number;
  classCompletionPercent: number;
  students?: StudentMetric[];
}
export default function TeacherLabMetricsPage() {
  const params = useParams();
  const search = useSearchParams();
  const labId = String(params.labId || "");
  const sectionId = search.get("sectionId") || undefined;
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ClassMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherLabsAPI
      .metrics(labId, sectionId)
      .then(({ data }) => {
        if (!cancelled) setData(data);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load class metrics. Please return to your labs and try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labId, sectionId]);
  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  const rows = (data?.students || []).filter((row) =>
    `${row.student?.name || ""} ${row.student?.uid || ""} ${row.student?.email || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className={labsPage}>
      <LabsHeader
        title="Class metrics"
        backHref={`/teacher/labs/${labId}?sectionId=${sectionId || ""}`}
        description={`${data?.lab?.title || "Lab"} · ${data?.section?.code || "Section"} · Student performance and completion`}
      />
      {error ? (
        <LabsNotice>{error}</LabsNotice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Students", data?.enrolledCount || 0],
              ["Problems", data?.totalProblems || 0],
              ["Experiments", data?.experimentCount || 0],
              ["Completion", `${data?.classCompletionPercent || 0}%`],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Student roster</h2>
            <input
              aria-label="Search students in class"
              type="search"
              placeholder="Search name, UID, or email…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${labsControl} w-full sm:w-72`}
            />
          </div>
          <LabsTable label="Class student metrics">
            <thead>
              <tr>
                <th>Student</th>
                <th>Section</th>
                <th>Solved</th>
                <th>Completion</th>
                <th>Attempts</th>
                <th>Time</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student?.id}>
                  <td>
                    <p className="font-medium">{row.student?.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.student?.uid || row.student?.email}
                    </p>
                  </td>
                  <td className="text-xs">{row.sectionLabel}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {row.solvedCount} / {row.totalProblems}
                  </td>
                  <td>
                    <LabsProgress
                      value={row.completionPercent}
                      label={`${row.student?.name || "Student"} completion`}
                    />
                  </td>
                  <td className="tabular-nums">{row.attempts}</td>
                  <td className="text-muted-foreground">
                    {Math.floor((row.timeSpentSeconds || 0) / 60)}m
                  </td>
                  <td className="tabular-nums">{row.score ?? 0}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {query
                      ? "No students match your search."
                      : "No enrolled students in this section."}
                  </td>
                </tr>
              )}
            </tbody>
          </LabsTable>
        </>
      )}
    </div>
  );
}
