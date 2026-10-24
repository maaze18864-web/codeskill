"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { adminLabsAPI } from "@/config/api";
import { Spinner } from "@/components/ui/spinner";
import {
  LabsHeader,
  LabsNotice,
  labsPage,
  labsAction,
  labsPrimary,
  labsControl,
  labsList,
} from "@/components/labs/LabsUI";
import type { LabSectionSummary, LabSummary } from "@/lib/labs-types";
import { LabsAnalytics } from "@/components/labs/LabsAnalytics";
import { labActivityDate, type LabsDashboardData } from "@/lib/labs-dashboard";

interface AdminSnapshot {
  sections: number;
  enrollments: number;
  labs: number;
  experiments: number;
  teacherAssignments: number;
  analytics: LabsDashboardData;
}
export default function AdminLabsDashboardPage() {
  const [sectionId, setSectionId] = useState("");
  const [labId, setLabId] = useState("");
  const [sections, setSections] = useState<LabSectionSummary[]>([]);
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [filterError, setFilterError] = useState(false);
  const [stats, setStats] = useState<AdminSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    adminLabsAPI
      .dashboard({
        sectionId: sectionId || undefined,
        labId: labId || undefined,
      })
      .then(({ data }) => {
        if (!data?.analytics?.summary)
          throw new Error("Labs analytics unavailable");
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("Could not refresh the Labs overview. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision, sectionId, labId]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([adminLabsAPI.listSections(), adminLabsAPI.listLabs()])
      .then(([s, l]) => {
        if (!cancelled) {
          setSections(
            labsList<LabSectionSummary>(s.data).filter(
              (s) => s.isActive !== false,
            ),
          );
          setLabs(
            labsList<LabSummary>(l.data).filter(
              (l) => l.status === "published",
            ),
          );
          setFilterError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFilterError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  return (
    <div className={labsPage}>
      <LabsHeader
        title="Labs overview"
        description="Participation, learning progress, and teaching coverage across your institution."
      >
        <Link href="/projects" className={labsAction}>Projects</Link>
        <Link href="/admin/labs/sections" className={labsAction}>
          Manage sections
        </Link>
        <Link href="/admin/labs/catalog" className={labsPrimary}>
          Lab catalog
          <ArrowUpRight className="size-3.5" />
        </Link>
      </LabsHeader>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Institution overview
          </span>
          {stats && (
            <>
              <span>
                {stats.sections} {stats.sections === 1 ? "section" : "sections"}
              </span>
              <span>
                {stats.labs} subject {stats.labs === 1 ? "lab" : "labs"}
              </span>
              <span>{stats.teacherAssignments} teaching assignments</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="text-[10px] text-muted-foreground">
              Updated {labActivityDate(stats.analytics.generatedAt)}
            </span>
          )}
          <button
            aria-label="Refresh Labs overview"
            className={labsAction}
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRevision((r) => r + 1);
            }}
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 space-y-1.5 text-xs text-muted-foreground">
          <span>Section scope</span>
          <select
            aria-label="Filter dashboard section"
            className={`${labsControl} w-full`}
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setStats(null);
              setLoading(true);
              setError(null);
            }}
          >
            <option value="">All active sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-48 flex-1 space-y-1.5 text-xs text-muted-foreground">
          <span>Subject scope</span>
          <select
            aria-label="Filter dashboard subject"
            className={`${labsControl} w-full`}
            value={labId}
            onChange={(e) => {
              setLabId(e.target.value);
              setStats(null);
              setLoading(true);
              setError(null);
            }}
          >
            <option value="">All published subjects</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
        {(sectionId || labId) && (
          <button
            className={labsAction}
            onClick={() => {
              setSectionId("");
              setLabId("");
              setStats(null);
              setLoading(true);
              setError(null);
            }}
          >
            Clear filters
          </button>
        )}
      </div>
      {filterError && (
        <LabsNotice>
          Section and subject filters could not be loaded. Refresh to try again.
        </LabsNotice>
      )}
      {error && <LabsNotice>{error}</LabsNotice>}
      {loading && !stats ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner />
        </div>
      ) : stats ? (
        <LabsAnalytics data={stats.analytics} role="admin" />
      ) : null}
    </div>
  );
}
