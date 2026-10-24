"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  aggregateLabSections,
  labChartColors as colors,
  type LabsCohort,
} from "@/lib/labs-dashboard";
import { labsAction, labsControl } from "./LabsUI";

const Chart = dynamic(
  () => import("./LabsCharts").then((m) => m.SectionProgressChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 animate-pulse rounded-lg bg-muted/40" />
    ),
  },
);
export function SectionComparison({ cohorts }: { cohorts: LabsCohort[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("completion-asc");
  const [page, setPage] = useState(0);
  const rows = useMemo(
    () =>
      aggregateLabSections(cohorts)
        .filter(
          (c) =>
            c.assigned > 0 &&
            `${c.code} ${c.name}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.code.localeCompare(b.code)
            : (sort === "completion-desc" ? -1 : 1) *
                (a.solved / a.assigned - b.solved / b.assigned) ||
              a.code.localeCompare(b.code),
        ),
    [cohorts, query, sort],
  );
  const current = Math.min(page, Math.max(0, Math.ceil(rows.length / 8) - 1));
  const visible = rows.slice(current * 8, current * 8 + 8);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 size-3.5 text-muted-foreground" />
          <input
            aria-label="Search chart sections"
            type="search"
            placeholder="Find a section…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className={`${labsControl} w-full pl-9`}
          />
        </div>
        <select
          aria-label="Sort section chart"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(0);
          }}
          className={`${labsControl} max-w-full`}
        >
          <option value="completion-asc">Lowest completion</option>
          <option value="completion-desc">Highest completion</option>
          <option value="name">Section code</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        {[
          ["Solved", colors.solved],
          ["In progress", colors.practicing],
          ["Not started", colors.pending],
        ].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      {visible.length ? (
        <Chart sections={visible} />
      ) : (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          No sections with published problem work match this search.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-[11px] text-muted-foreground" aria-live="polite">
          {rows.length
            ? `${current * 8 + 1}–${Math.min((current + 1) * 8, rows.length)} of ${rows.length} sections`
            : "0 sections"}{" "}
          · grouped across subjects
        </p>
        <div className="flex gap-1.5">
          <button
            className={labsAction}
            aria-label="Previous chart sections"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            className={labsAction}
            aria-label="Next chart sections"
            disabled={(current + 1) * 8 >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
