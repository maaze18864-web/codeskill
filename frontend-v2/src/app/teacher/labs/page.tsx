"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, RefreshCw } from "lucide-react";
import { teacherLabsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import {
  LabsHeader,
  LabsNotice,
  LabsEmpty,
  LabsTable,
  LabsBadge,
  labsPage,
  labsAction,
  labsList,
  labsControl,
} from "@/components/labs/LabsUI";
import { LabsAnalytics } from "@/components/labs/LabsAnalytics";
import { labActivityDate, type LabsDashboardData } from "@/lib/labs-dashboard";
import type { TeacherLabSummary } from "@/lib/labs-types";
export default function TeacherLabsPage() {
  const [analytics, setAnalytics] = useState<LabsDashboardData | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [labId, setLabId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(true);
  const [rows, setRows] = useState<TeacherLabSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    teacherLabsAPI
      .list()
      .then(({ data }) => {
        if (!cancelled) setRows(labsList(data));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your assigned labs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    teacherLabsAPI
      .dashboard(sectionId || undefined, labId || undefined)
      .then(({ data }) => {
        if (!cancelled) {
          setAnalytics(data);
          setAnalyticsError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalytics(null);
          setAnalyticsError(
            "Could not load teaching metrics. Please refresh to try again.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sectionId, labId, revision]);
  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  const filtered = rows.filter(
    (row) =>
      (!sectionId || row.section?.id === sectionId) &&
      (!labId || row.lab.id === labId) &&
      `${row.lab.title} ${row.lab.subject || ""} ${row.sectionLabel || row.section?.code || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className={labsPage}>
      <LabsHeader
        title="Teaching overview"
        description="Participation and progress across the subject labs and sections you teach."
      >
        <Link href="/projects" className={labsAction}>Projects</Link>
      </LabsHeader>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="teaching-section" className="text-xs font-medium">
            Your sections
          </label>
          <select
            id="teaching-section"
            value={sectionId}
            className={labsControl}
            onChange={(e) => {
              setSectionId(e.target.value);
              setAnalytics(null);
              setRefreshing(true);
            }}
          >
            <option value="">All assigned sections</option>
            {[
              ...new Map(
                rows
                  .filter((r) => r.section?.id && r.section.isActive !== false)
                  .map((r) => [r.section!.id, r.section!]),
              ).values(),
            ].map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="teaching-subject" className="text-xs font-medium">
            Subject
          </label>
          <select
            id="teaching-subject"
            value={labId}
            className={labsControl}
            onChange={(e) => {
              setLabId(e.target.value);
              setAnalytics(null);
              setRefreshing(true);
            }}
          >
            <option value="">All assigned subjects</option>
            {[
              ...new Map(
                rows
                  .filter((r) => r.lab.status === "published")
                  .map((r) => [r.lab.id, r.lab]),
              ).values(),
            ].map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          {analytics && (
            <span className="text-[10px] text-muted-foreground">
              Updated {labActivityDate(analytics.generatedAt)}
            </span>
          )}
          <button
            className={labsAction}
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              setRevision((r) => r + 1);
            }}
          >
            <RefreshCw
              className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh metrics
          </button>
        </div>
      </div>
      {analyticsError && <LabsNotice>{analyticsError}</LabsNotice>}
      {refreshing && !analytics ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        analytics && <LabsAnalytics data={analytics} role="teacher" />
      )}
      <div className="border-t border-border pt-6">
        <h2 className="text-base font-semibold">Assigned subject labs</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Open an experiment or drill into the student roster for a section.
        </p>
      </div>
      {error ? (
        <LabsNotice>{error}</LabsNotice>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {rows.length} subject-section{" "}
              {rows.length === 1 ? "assignment" : "assignments"}
            </p>
            <input
              aria-label="Search assigned labs"
              type="search"
              placeholder="Search subject or section…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${labsControl} w-full sm:w-72`}
            />
          </div>
          {filtered.length ? (
            <LabsTable label="Teacher lab assignments">
              <thead>
                <tr>
                  <th>Subject lab</th>
                  <th>Section</th>
                  <th>Role</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <p className="font-semibold">{row.lab.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.lab.subject || "General"}
                      </p>
                    </td>
                    <td>
                      <p className="font-medium">
                        {row.sectionLabel || row.section?.code}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.section?.name}
                      </p>
                    </td>
                    <td>
                      <LabsBadge>{row.role || "Instructor"}</LabsBadge>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/teacher/labs/${row.lab.id}?sectionId=${row.section?.id || ""}`}
                          className={labsAction}
                        >
                          Experiments
                        </Link>
                        <Link
                          href={`/teacher/labs/${row.lab.id}/metrics?sectionId=${row.section?.id || ""}`}
                          className={`${labsAction} text-primary`}
                        >
                          <BarChart3 className="size-3.5" />
                          Class metrics
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </LabsTable>
          ) : (
            <LabsEmpty
              title={
                search ? "No matching assignments" : "No labs assigned yet"
              }
              description={
                search
                  ? "Try another subject name or section code."
                  : "An administrator can assign you to a subject lab and academic section."
              }
            />
          )}
        </>
      )}
    </div>
  );
}
