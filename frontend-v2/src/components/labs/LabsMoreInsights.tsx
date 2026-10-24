"use client";
import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChartNoAxesCombined } from "lucide-react";
import type { LabsDashboardData } from "@/lib/labs-dashboard";
import { labsPanel } from "./LabsUI";
const Solves = dynamic(
  () => import("./LabsDetailCharts").then((m) => m.FirstSolvesChart),
  { ssr: false },
);
const Distribution = dynamic(
  () => import("./LabsDetailCharts").then((m) => m.LearnerDistributionChart),
  { ssr: false },
);
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className={`${labsPanel} p-5 sm:p-6`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mb-4 mt-1 text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      {children}
    </section>
  );
}
export function LabsMoreInsights({ data }: { data: LabsDashboardData }) {
  const [expanded, setExpanded] = useState(false);
  const d = data.distributions;
  return (
    <section className="space-y-4">
      <button
        aria-expanded={expanded}
        aria-controls="lab-more-insights"
        onClick={() => setExpanded(!expanded)}
        className={`${labsPanel} flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:border-primary/30`}
      >
        <span className="flex items-center gap-3">
          <ChartNoAxesCombined className="size-5 text-primary" />
          <span>
            <span className="block text-sm font-semibold">
              More learning insights
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              First solves, completion distribution, engagement, and submission
              effort
            </span>
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div id="lab-more-insights" className="grid gap-5 lg:grid-cols-2">
          <Panel
            title="First solves over time"
            description="First solves of assigned student–problem pairs over the last 14 days (UTC). Today is partial; repeat solves are excluded."
          >
            {data.firstSolves?.length ? (
              <>
                <Solves data={data.firstSolves} />
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    View daily counts
                  </summary>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {data.firstSolves.map((r) => (
                      <p key={r.date}>
                        {r.date}: <strong>{r.solves}</strong>
                      </p>
                    ))}
                  </div>
                </details>
              </>
            ) : (
              <p className="py-16 text-xs text-muted-foreground">
                No first-solve timestamps available.
              </p>
            )}
          </Panel>
          <Panel
            title="Where students stand"
            description="Students grouped by the share of their assigned work solved."
          >
            {d && data.summary.students ? (
              <>
                <Distribution data={d.completion} />
                <Counts rows={d.completion} />
              </>
            ) : (
              <Empty />
            )}
          </Panel>
          <Panel
            title="Activity recency"
            description="Each student’s latest recorded lab interaction. Engagement is not live attendance."
          >
            {d && data.summary.students ? (
              <>
                <Distribution data={d.activity} color="#5b83ae" horizontal />
                <Counts rows={d.activity} />
              </>
            ) : (
              <Empty />
            )}
          </Panel>
          <Panel
            title="Attempts per started problem"
            description="Students grouped by average recorded submission attempts per problem started, accounting for different assignment loads. This is not an accuracy score."
          >
            {d && data.summary.students ? (
              <>
                <Distribution data={d.attempts} color="#d59638" />
                <Counts rows={d.attempts} />
              </>
            ) : (
              <Empty />
            )}
          </Panel>
        </div>
      )}
    </section>
  );
}
function Empty() {
  return (
    <p className="py-16 text-xs text-muted-foreground">
      No distribution data available in this scope.
    </p>
  );
}
function Counts({ rows }: { rows: Array<{ label: string; count: number }> }) {
  return (
    <div className="sr-only">
      {rows.map((r) => (
        <p key={r.label}>
          {r.label}: {r.count} students
        </p>
      ))}
    </div>
  );
}
