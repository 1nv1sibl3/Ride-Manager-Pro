"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/pricing";

// Single-series revenue trend. One series → no legend (the title names it),
// 2px line, ~10% wash fill, hairline grid, recessive axes, crosshair tooltip.

export type RevenuePoint = {
  date: string; // YYYY-MM-DD (IST)
  label: string; // "4 Sep"
  revenue: number;
};

function compactInr(v: number): string {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return `₹${v}`;
}

export function RevenueChart({ data, className }: { data: RevenuePoint[]; className?: string }) {
  const [range, setRange] = useState<30 | 90>(30);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const c = dark
    ? { primary: "#3b82f6", grid: "#27272a", tick: "#a1a1aa" }
    : { primary: "#2563eb", grid: "#e4e4e7", tick: "#71717a" };

  const series = data.slice(-range);

  return (
    <div className={cn("card", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Revenue</h2>
          <p className="text-xs text-muted">Cash in per day (IST) · deposits excluded</p>
        </div>
        <div className="flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
          {([30, 90] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 230 }} role="img" aria-label={`Daily revenue for the last ${range} days`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: c.tick }}
              tickLine={false}
              axisLine={{ stroke: c.grid }}
              interval="preserveStartEnd"
              minTickGap={48}
            />
            <YAxis
              tickFormatter={compactInr}
              tick={{ fontSize: 11, fill: c.tick }}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <Tooltip content={<RevenueTooltip />} cursor={{ stroke: c.grid, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={c.primary}
              strokeWidth={2}
              fill={c.primary}
              fillOpacity={0.1}
              activeDot={{ r: 4, strokeWidth: 2, stroke: dark ? "#18181b" : "#ffffff" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RevenueTooltip({ active, payload }: {
  active?: boolean;
  payload?: { value?: number; payload?: RevenuePoint }[];
}) {
  if (!active || !payload?.length || payload[0]?.value == null) return null;
  const point = payload[0].payload;
  return (
    <div className="card p-2.5 text-xs shadow-md">
      <div className="text-muted">{point?.date}</div>
      <div className="mt-0.5 font-semibold">{inr(payload[0].value)}</div>
    </div>
  );
}
