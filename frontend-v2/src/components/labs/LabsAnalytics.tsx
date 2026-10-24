"use client";

import { SectionComparison } from "./SectionComparison";
import { LabsMoreInsights } from "./LabsMoreInsights";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowUpRight,
  Users,
  Activity,
  CircleCheck,
  ScanEye,
  ChevronRight,
  Clock3,
} from "lucide-react";
import {
  LabsEmpty,
  LabsProgress,
  LabsTable,
  labsAction,
  labsPanel,
  labsControl,
} from "./LabsUI";
import {
  labChartColors as colors,
  labActivityDate,
  labPercent,
  type LabsDashboardData,
} from "@/lib/labs-dashboard";

const LearnerChart = dynamic(
  () => import("./LabsCharts").then((m) => m.LearnerProgressChart),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto h-[190px] w-48 animate-pulse rounded-full bg-muted/40" />
    ),
  },
);
const number = (n: number) => n.toLocaleString();

export function LabsAnalytics({
  data,
  role,
}: {
  data: LabsDashboardData;
  role: "admin" | "teacher";
}) {
  const [reviewTab, setReviewTab] = useState<"review" | "notStarted">("review");
  const [cohortPage, setCohortPage] = useState(0);
  const [cohortQuery, setCohortQuery] = useState("");
  const cohorts = data.cohorts.filter((c) =>
    `${c.section_code} ${c.section_name} ${c.lab_title}`
      .toLowerCase()
      .includes(cohortQuery.toLowerCase()),
  );
  const currentCohortPage = Math.min(
    cohortPage,
    Math.max(0, Math.ceil(cohorts.length / 8) - 1),
  );
  const visibleCohorts = cohorts.slice(
    currentCohortPage * 8,
    currentCohortPage * 8 + 8,
  );
  const [experimentPage, setExperimentPage] = useState(0);
  const sortedExperiments = [...data.experiments].sort(
    (a, b) =>
      a.solved / a.assigned - b.solved / b.assigned ||
      a.title.localeCompare(b.title),
  );
  const currentExperimentPage = Math.min(
    experimentPage,
    Math.max(0, Math.ceil(sortedExperiments.length / 10) - 1),
  );
  const s = data.summary;
  const learners =
    reviewTab === "review" ? data.attention : data.notStartedLearners;
  const reviewCount = reviewTab === "review" ? s.needsReview : s.notStarted;
  const metrics = [
    {
      label: "Students with lab work",
      value: number(s.students),
      detail: `${number(s.active7d)} active in the last 7 days`,
      icon: Users,
    },
    {
      label: "Participation",
      value: `${s.participationPercent}%`,
      detail: `${number(s.started)} of ${number(s.students)} students have started`,
      icon: Activity,
    },
    {
      label: "Assigned work completed",
      value: `${s.completionPercent}%`,
      detail: `${number(s.solved)} of ${number(s.assigned)} problem assignments solved`,
      icon: CircleCheck,
    },
    {
      label: "Needs review",
      value: number(s.needsReview),
      detail: "Repeated unsolved attempts or 7+ days inactive",
      icon: ScanEye,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={`${labsPanel} relative p-5 ${i === 2 ? "border-primary/25 bg-primary/[0.035]" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {m.label}
              </p>
              <m.icon
                className={`size-4 ${i === 2 ? "text-primary" : "text-muted-foreground/70"}`}
              />
            </div>
            <p className="mt-4 text-[32px] font-semibold leading-none tracking-tight tabular-nums">
              {s.assigned || i === 0 ? m.value : "—"}
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {m.detail}
            </p>
          </div>
        ))}
      </div>

      {s.assigned > 0 ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]">
          <section
            className={`${labsPanel} p-5 sm:p-6`}
            aria-labelledby="cohort-chart-title"
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="cohort-chart-title" className="text-sm font-semibold">
                  Section completion
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  All published work, including problems not yet started.
                </p>
              </div>
            </div>
            <SectionComparison cohorts={data.cohorts} />
          </section>
          <section
            className={`${labsPanel} flex flex-col p-5 sm:p-6`}
            aria-labelledby="learner-chart-title"
          >
            <h2 id="learner-chart-title" className="text-sm font-semibold">
              Student participation
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One student counted once in this view.
            </p>
            <LearnerChart summary={s} />
            <div className="mt-auto space-y-3 text-xs">
              {[
                ["Completed all assigned work", s.completed, colors.solved],
                [
                  "Started, work remaining",
                  s.started - s.completed,
                  colors.practicing,
                ],
                ["Haven’t started", s.notStarted, colors.pending],
              ].map(([label, count, color]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span
                      className="size-2 rounded-sm"
                      style={{ background: String(color) }}
                    />
                    {label}
                  </span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <LabsEmpty
          title="No published problem work to measure yet"
          description={
            role === "admin"
              ? "Publish an experiment with problems, assign its subject lab to a section, and enroll students to see participation and completion here."
              : "Metrics appear when your assigned sections have enrolled students and published lab problems."
          }
        />
      )}

      <LabsMoreInsights data={data} />

      <section className="space-y-3" aria-labelledby="sections-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="sections-title" className="text-sm font-semibold">
              {role === "admin"
                ? "Section performance"
                : "Your sections at a glance"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.cohorts.length} published subject-section{" "}
              {data.cohorts.length === 1 ? "assignment" : "assignments"} ·
              current active enrollments
            </p>
          </div>
          {role === "admin" && (
            <Link href="/admin/labs/sections" className={labsAction}>
              Manage sections
              <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </div>
        <input
          aria-label="Search section performance"
          type="search"
          placeholder="Search section or subject…"
          value={cohortQuery}
          onChange={(e) => {
            setCohortQuery(e.target.value);
            setCohortPage(0);
          }}
          className={`${labsControl} w-full sm:max-w-80`}
        />
        <LabsTable label="Section lab performance">
          <thead>
            <tr>
              <th>Section / subject</th>
              <th>Participation</th>
              <th>Published work</th>
              <th>Completion</th>
              <th>{role === "admin" ? "Teaching cover" : "Details"}</th>
            </tr>
          </thead>
          <tbody>
            {visibleCohorts.map((c) => (
              <tr key={`${c.section_id}:${c.lab_id}`}>
                <td>
                  <p className="font-semibold">{c.section_code}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.lab_title}
                  </p>
                </td>
                <td>
                  <p className="font-medium tabular-nums">
                    {c.started_students} / {c.students}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    students started
                  </p>
                </td>
                <td>
                  <p className="tabular-nums">
                    {c.problems} {c.problems === 1 ? "problem" : "problems"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.experiments} published{" "}
                    {c.experiments === 1 ? "experiment" : "experiments"}
                  </p>
                </td>
                <td className="min-w-40">
                  {c.assigned ? (
                    <>
                      <LabsProgress
                        value={labPercent(c.solved, c.assigned)}
                        label={`${c.section_code} ${c.lab_title} completion`}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {c.solved} / {c.assigned} problem assignments
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {c.students
                        ? "No problems published"
                        : "No active students"}
                    </span>
                  )}
                </td>
                <td>
                  {role === "teacher" ? (
                    <Link
                      href={`/teacher/labs/${c.lab_id}/metrics?sectionId=${c.section_id}`}
                      className={`${labsAction} text-primary`}
                    >
                      Class metrics
                      <ChevronRight className="size-3.5" />
                    </Link>
                  ) : (
                    <span
                      className={`text-xs ${c.teachers ? "text-muted-foreground" : "font-medium text-amber-700 dark:text-amber-400"}`}
                    >
                      {c.teachers
                        ? `${c.teachers} assigned`
                        : "No teacher assigned"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {!cohorts.length && (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No published labs match this view.
                </td>
              </tr>
            )}
          </tbody>
        </LabsTable>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground" aria-live="polite">
            {cohorts.length
              ? `${currentCohortPage * 8 + 1}–${Math.min((currentCohortPage + 1) * 8, cohorts.length)} of ${cohorts.length} subject-sections`
              : "0 subject-sections"}
          </p>
          <div className="flex gap-2">
            <button
              className={labsAction}
              disabled={currentCohortPage === 0}
              onClick={() => setCohortPage(currentCohortPage - 1)}
            >
              Previous rows
            </button>
            <button
              className={labsAction}
              disabled={(currentCohortPage + 1) * 8 >= cohorts.length}
              onClick={() => setCohortPage(currentCohortPage + 1)}
            >
              Next rows
            </button>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(280px,1fr)]">
        <section className={`${labsPanel}`} aria-labelledby="review-title">
          <div className="border-b border-border p-5">
            <div className="flex items-center justify-between">
              <h2 id="review-title" className="text-sm font-semibold">
                Student follow-up
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {reviewCount > 10
                  ? `First 10 of ${reviewCount}`
                  : `${reviewCount} ${reviewCount === 1 ? "student" : "students"}`}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Use these signals to decide who to check in with.
            </p>
            <div
              className="mt-4 inline-flex rounded-lg bg-muted/60 p-1"
              aria-label="Student follow-up filters"
            >
              {(
                [
                  ["review", `Needs review · ${s.needsReview}`],
                  ["notStarted", `Not started · ${s.notStarted}`],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setReviewTab(tab)}
                  aria-pressed={reviewTab === tab}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${reviewTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border">
            {learners.map((st) => (
              <div
                key={st.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium">
                    {st.name}
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                      {st.uid || st.sections}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {st.reason || "No recorded work on assigned problems"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium tabular-nums">
                    {st.solved} / {st.assigned} solved
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {labActivityDate(st.last_activity)}
                  </p>
                </div>
              </div>
            ))}
            {!learners.length && (
              <div className="flex min-h-36 items-center gap-3 p-5">
                <CircleCheck className="size-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">
                    {reviewTab === "review"
                      ? "No students flagged for review"
                      : "Everyone with assigned work has started"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reviewTab === "review"
                      ? "Flagged after 3+ attempts on an unsolved problem or 7+ inactive days with work remaining."
                      : "This view includes active students with published problems."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
        <section className={`${labsPanel} p-5`} aria-labelledby="recent-title">
          <div className="flex items-center gap-2">
            <Clock3 className="size-4 text-muted-foreground" />
            <h2 id="recent-title" className="text-sm font-semibold">
              Latest student activity
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Most recent recorded activity per student.
          </p>
          <div className="mt-4 space-y-4">
            {data.recentActivity.map((st) => (
              <div key={st.id} className="flex gap-3">
                <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold">{st.name}</p>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {st.solved}/{st.assigned} solved
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {st.sections} · {labActivityDate(st.last_activity)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {!data.recentActivity.length && (
            <p className="py-8 text-xs text-muted-foreground">
              Student activity will appear here once lab work begins.
            </p>
          )}
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xl font-semibold tracking-tight tabular-nums">
              {number(s.attempts)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Total recorded submission attempts on assigned work
            </p>
          </div>
        </section>
      </div>

      {!!data.experiments.length && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Experiment breakdown</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Lowest completion first. See whether work is untouched or students
              are still trying.
            </p>
          </div>
          <LabsTable label="Experiment completion breakdown">
            <thead>
              <tr>
                <th>Experiment</th>
                <th>Students</th>
                <th>Solved</th>
                <th>In progress</th>
                <th>Not started</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {sortedExperiments
                .slice(
                  currentExperimentPage * 10,
                  currentExperimentPage * 10 + 10,
                )
                .map((e) => (
                  <tr key={e.id}>
                    <td>
                      <p className="font-medium">{e.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {e.lab_title}
                      </p>
                    </td>
                    <td className="tabular-nums">{e.students}</td>
                    <td className="tabular-nums">
                      {e.solved} / {e.assigned}
                    </td>
                    <td className="tabular-nums">{e.practicing}</td>
                    <td className="tabular-nums">
                      {e.assigned - e.solved - e.practicing}
                    </td>
                    <td className="min-w-36">
                      <LabsProgress
                        value={labPercent(e.solved, e.assigned)}
                        label={`${e.title} completion`}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </LabsTable>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">
              {currentExperimentPage * 10 + 1}–
              {Math.min(
                (currentExperimentPage + 1) * 10,
                sortedExperiments.length,
              )}{" "}
              of {sortedExperiments.length} experiments
            </p>
            <div className="flex gap-2">
              <button
                className={labsAction}
                disabled={currentExperimentPage === 0}
                onClick={() => setExperimentPage(currentExperimentPage - 1)}
              >
                Previous experiments
              </button>
              <button
                className={labsAction}
                disabled={
                  (currentExperimentPage + 1) * 10 >= sortedExperiments.length
                }
                onClick={() => setExperimentPage(currentExperimentPage + 1)}
              >
                Next experiments
              </button>
            </div>
          </div>
        </section>
      )}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Based on recorded lab progress, active enrollments, and published
        problems. A problem assignment is one problem for one student; shared
        work is counted once in overall totals. Activity reflects the latest
        recorded interaction, not live attendance.
      </p>
    </div>
  );
}
