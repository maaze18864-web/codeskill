"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { studentLabsAPI, teacherLabsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import {
  LabsHeader,
  LabsNotice,
  LabsEmpty,
  LabsTable,
  LabsProgress,
  labsPage,
  labsPageWithNavigation,
  labsAction,
  labsControl,
} from "./LabsUI";
import type { LabSummary, LabExperimentSummary } from "@/lib/labs-types";
export function LabExperiments({
  labId,
  teacher = false,
  sectionId = "",
}: {
  labId: string;
  teacher?: boolean;
  sectionId?: string;
}) {
  const [lab, setLab] = useState<LabSummary | null>(null);
  const [experiments, setExperiments] = useState<LabExperimentSummary[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const root = teacher ? "/teacher/labs" : "/labs";
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (teacher ? teacherLabsAPI : studentLabsAPI)
      .experiments(labId)
      .then(({ data }) => {
        if (!cancelled) {
          setLab(data.lab);
          setExperiments(data.experiments || []);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Could not load experiments. Please return to your labs and try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [labId, teacher]);
  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  const filtered = experiments.filter((row) =>
    `${row.title} ${row.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const current = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  return (
    <div className={teacher ? labsPage : labsPageWithNavigation}>
      <LabsHeader
        title={lab?.title || "Lab experiments"}
        backHref={root}
        description={
          lab?.description ||
          "Work through the experiments and open each coding workspace when you are ready."
        }
      >
        {teacher && (
          <Link
            href={`${root}/${labId}/metrics?sectionId=${sectionId}`}
            className={labsAction}
          >
            <BarChart3 className="size-4" />
            Class metrics
          </Link>
        )}
      </LabsHeader>
      {error ? (
        <LabsNotice>{error}</LabsNotice>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {experiments.length}{" "}
              {experiments.length === 1 ? "experiment" : "experiments"}
            </p>
            <input
              aria-label="Search experiments"
              type="search"
              placeholder="Search experiments…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className={`${labsControl} w-full sm:w-72`}
            />
          </div>
          {current.length ? (
            <LabsTable label="Lab experiments">
              <thead>
                <tr>
                  <th>Experiment</th>
                  <th>Problems</th>
                  {!teacher && <th>Progress</th>}
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {current.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                          {String((currentPage - 1) * 10 + index + 1).padStart(
                            2,
                            "0",
                          )}
                        </span>
                        <div>
                          <p className="font-semibold">{row.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {row.description && row.description !== "Labs"
                              ? row.description
                              : "Coding experiment"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="tabular-nums">
                      {teacher
                        ? row.problemCount || 0
                        : `${row.solvedCount || 0} / ${row.problemCount || 0}`}
                    </td>
                    {!teacher && (
                      <td>
                        <LabsProgress
                          value={
                            row.problemCount
                              ? Math.round(
                                  ((row.solvedCount || 0) / row.problemCount) *
                                    100,
                                )
                              : 0
                          }
                          label={`${row.title} progress`}
                        />
                      </td>
                    )}
                    <td className="text-right">
                      <Link
                        href={`${root}/${labId}/experiments/${row.id}`}
                        className={`${labsAction} text-primary`}
                      >
                        Open experiment
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </LabsTable>
          ) : (
            <LabsEmpty
              title={
                search
                  ? "No matching experiments"
                  : "No experiments published yet"
              }
              description={
                search
                  ? "Try a different title or clear your search."
                  : "Published experiments will appear here when your instructor adds them."
              }
            />
          )}
          {filtered.length > 10 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {(currentPage - 1) * 10 + 1}–
                {Math.min(currentPage * 10, filtered.length)} of{" "}
                {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className={labsAction}
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {currentPage} / {pages}
                </span>
                <button
                  className={labsAction}
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
