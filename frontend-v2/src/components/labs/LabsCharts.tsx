"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  labChartColors as colors,
  type LabsDashboardData,
  type LabsSectionChartRow,
} from "@/lib/labs-dashboard";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

export function SectionProgressChart({
  sections,
}: {
  sections: LabsSectionChartRow[];
}) {
  const data = sections.map((c) => ({
    label: c.code,
    ...c,
    completed: (100 * c.solved) / c.assigned,
    underway: (100 * c.practicing) / c.assigned,
    pending: (100 * (c.assigned - c.solved - c.practicing)) / c.assigned,
  }));
  return (
    <BarChart
      responsive
      accessibilityLayer
      layout="vertical"
      data={data}
      style={{ width: "100%", height: Math.max(210, data.length * 38 + 35) }}
      margin={{ left: 0, right: 15, top: 12, bottom: 0 }}
      barSize={19}
    >
      <CartesianGrid
        horizontal={false}
        stroke="hsl(var(--border))"
        strokeDasharray="3 5"
      />
      <XAxis
        type="number"
        domain={[0, 100]}
        ticks={[0, 25, 50, 75, 100]}
        tickFormatter={(n) => `${n}%`}
        axisLine={false}
        tickLine={false}
        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
      />
      <YAxis
        type="category"
        dataKey="label"
        width={116}
        axisLine={false}
        tickLine={false}
        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
        tickFormatter={(s: string) =>
          s.length > 23 ? `${s.slice(0, 22)}…` : s
        }
      />
      <Tooltip
        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
        content={({ active, payload }) => {
          const c = payload?.[0]?.payload;
          if (!active || !c) return null;
          return (
            <div
              style={tooltipStyle}
              className="max-w-72 space-y-1.5 p-3 shadow-lg"
            >
              <p className="font-semibold">
                {c.label} · {c.name}
              </p>
              <p>
                {c.students} enrolled · {c.labs} subject labs
              </p>
              <p>
                {c.solved} solved · {c.practicing} in progress ·{" "}
                {c.assigned - c.solved - c.practicing} not started
              </p>
              <p className="text-muted-foreground">
                {c.assigned} student–problem assignments
              </p>
            </div>
          );
        }}
      />
      <Bar
        dataKey="completed"
        name="Solved"
        stackId="work"
        fill={colors.solved}
        isAnimationActive={false}
      />
      <Bar
        dataKey="underway"
        name="In progress"
        stackId="work"
        fill={colors.practicing}
        isAnimationActive={false}
      />
      <Bar
        dataKey="pending"
        name="Not started"
        stackId="work"
        fill={colors.pending}
        radius={[0, 4, 4, 0]}
        isAnimationActive={false}
      />
    </BarChart>
  );
}

export function LearnerProgressChart({
  summary,
}: {
  summary: LabsDashboardData["summary"];
}) {
  const data = [
    {
      name: "Completed all work",
      value: summary.completed,
      fill: colors.solved,
    },
    {
      name: "In progress",
      value: summary.started - summary.completed,
      fill: colors.practicing,
    },
    { name: "Not started", value: summary.notStarted, fill: colors.pending },
  ].filter((d) => d.value > 0);
  return (
    <div className="relative mx-auto h-[190px] w-[230px] max-w-full">
      <PieChart
        responsive
        accessibilityLayer
        style={{ width: "100%", height: "100%" }}
      >
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={66}
          outerRadius={83}
          paddingAngle={data.length > 1 ? 4 : 0}
          cornerRadius={5}
          stroke="none"
          isAnimationActive={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          itemStyle={{ color: "hsl(var(--foreground))" }}
        />
      </PieChart>
      <div
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {summary.students}
        </span>
        <span className="mt-1 text-xs text-muted-foreground">students</span>
      </div>
    </div>
  );
}
