"use client";
import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LabsDashboardData, LabsDistribution } from "@/lib/labs-dashboard";

const tick = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };
const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 10,
  color: "hsl(var(--foreground))",
  fontSize: 12,
};
const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function FirstSolvesChart({
  data,
}: {
  data: NonNullable<LabsDashboardData["firstSolves"]>;
}) {
  const gradientId = useId();
  return (
    <AreaChart
      responsive
      accessibilityLayer
      data={data}
      style={{ width: "100%", height: 260 }}
      margin={{ top: 15, right: 14, bottom: 0, left: -24 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#15976b" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#15976b" stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <CartesianGrid
        vertical={false}
        stroke="hsl(var(--border))"
        strokeDasharray="3 5"
      />
      <XAxis
        dataKey="date"
        tickFormatter={dateLabel}
        tick={tick}
        tickLine={false}
        axisLine={false}
        minTickGap={28}
      />
      <YAxis
        tick={tick}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        labelFormatter={(label) => `${dateLabel(String(label))} · UTC`}
        itemStyle={{ color: "hsl(var(--foreground))" }}
      />
      <Area
        type="linear"
        dataKey="solves"
        name="First solves"
        stroke="#15976b"
        strokeWidth={2.5}
        fill={`url(#${gradientId})`}
        activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}

export function LearnerDistributionChart({
  data,
  color = "#15976b",
  horizontal = false,
}: {
  data: LabsDistribution[];
  color?: string;
  horizontal?: boolean;
}) {
  return (
    <BarChart
      responsive
      accessibilityLayer
      layout={horizontal ? "vertical" : "horizontal"}
      data={data}
      barSize={horizontal ? 19 : 28}
      style={{ width: "100%", height: 235 }}
      margin={{ top: 12, right: 15, left: horizontal ? 0 : -28, bottom: 0 }}
    >
      <CartesianGrid
        horizontal={!horizontal}
        vertical={horizontal}
        stroke="hsl(var(--border))"
        strokeDasharray="3 5"
      />
      <XAxis
        type={horizontal ? "number" : "category"}
        dataKey={horizontal ? undefined : "label"}
        tick={tick}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
      />
      <YAxis
        type={horizontal ? "category" : "number"}
        dataKey={horizontal ? "label" : undefined}
        tick={tick}
        width={horizontal ? 122 : 55}
        tickLine={false}
        axisLine={false}
        allowDecimals={false}
      />
      <Tooltip
        cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
        contentStyle={tooltipStyle}
        itemStyle={{ color: "hsl(var(--foreground))" }}
      />
      <Bar
        dataKey="count"
        name="Students"
        fill={color}
        radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
        isAnimationActive={false}
      />
    </BarChart>
  );
}
