import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/ChartCard";
import { formatCurrency, formatDateOnly, formatMiles, formatRPM, weekToMonday } from "@/lib/format";
import { chartColors } from "@/theme/chartColors";
import type { WeeklyTotalsRow } from "@/lib/types";

type Metric = "revenue" | "deadhead" | "rpm";

const METRICS: { key: Metric; label: string }[] = [
  { key: "revenue", label: "Weekly Revenue" },
  { key: "deadhead", label: "Deadhead Miles" },
  { key: "rpm", label: "Weighted RPM" },
];

function metricValue(row: WeeklyTotalsRow, metric: Metric): number {
  switch (metric) {
    case "revenue":
      return row.gross_revenue;
    case "deadhead":
      return row.total_deadhead_miles;
    case "rpm":
      return row.total_miles > 0 ? row.gross_revenue / row.total_miles : 0;
  }
}

function formatMetric(value: number, metric: Metric): string {
  switch (metric) {
    case "revenue":
      return formatCurrency(value);
    case "deadhead":
      return formatMiles(value);
    case "rpm":
      return formatRPM(value);
  }
}

function weekLabel(week: number, year: number): string {
  const monday = weekToMonday(week, year);
  const sunday = new Date(`${monday}T00:00:00Z`);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return `Week ${week}: ${formatDateOnly(monday)} - ${formatDateOnly(sunday.toISOString().slice(0, 10))}`;
}

interface ChartRow {
  week: number;
  year: number;
  label: string;
  shortLabel: string;
  value: number;
  loadCount: number;
  totalMiles: number;
}

export function WeekComparisonChart({
  weeklyTotals,
  selectedWeek,
  onSelectWeek,
}: {
  weeklyTotals: WeeklyTotalsRow[];
  selectedWeek: { week: number; year: number } | null;
  onSelectWeek: (week: number, year: number) => void;
}) {
  const [metric, setMetric] = useState<Metric>("revenue");

  const data = useMemo<ChartRow[]>(() => {
    return [...weeklyTotals]
      .sort((a, b) => a.week_year - b.week_year || a.week_number - b.week_number)
      .map((row) => ({
        week: row.week_number,
        year: row.week_year,
        label: weekLabel(row.week_number, row.week_year),
        shortLabel: `W${row.week_number}`,
        value: metricValue(row, metric),
        loadCount: row.load_count,
        totalMiles: row.total_miles,
      }));
  }, [weeklyTotals, metric]);

  return (
    <ChartCard title="Week-over-Week Comparison" subtitle="Click a bar to drill into that week's loads">
      <div className="mb-3 flex flex-wrap gap-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`rounded-md px-3 py-1.5 font-body text-xs font-medium transition-colors ${
              metric === m.key
                ? "bg-accent text-white"
                : "text-ink-muted hover:bg-surface-muted dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
          <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(v: number) =>
              metric === "revenue" ? `$${(v / 1000).toFixed(1)}k` : metric === "rpm" ? `$${v.toFixed(1)}` : `${v}`
            }
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as ChartRow;
              return (
                <div className="rounded-md border border-border bg-surface p-3 text-xs shadow-md dark:border-dark-border dark:bg-dark-surface">
                  <p className="mb-1 font-semibold text-ink dark:text-dark-ink">{row.label}</p>
                  <p className="text-ink-muted dark:text-dark-ink-muted">
                    {METRICS.find((m) => m.key === metric)?.label}:{" "}
                    <span className="font-mono text-ink dark:text-dark-ink">
                      {formatMetric(row.value, metric)}
                    </span>
                  </p>
                  <p className="text-ink-muted dark:text-dark-ink-muted">
                    Total Loads: <span className="font-mono text-ink dark:text-dark-ink">{row.loadCount}</span>
                  </p>
                  <p className="text-ink-muted dark:text-dark-ink-muted">
                    Total Miles:{" "}
                    <span className="font-mono text-ink dark:text-dark-ink">{formatMiles(row.totalMiles)}</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="value"
            cursor="pointer"
            radius={[3, 3, 0, 0]}
            onClick={(item: { payload?: ChartRow }) => {
              if (item.payload) onSelectWeek(item.payload.week, item.payload.year);
            }}
            activeBar={{ fill: chartColors.accentHover, stroke: chartColors.accentHover }}
          >
            {data.map((row) => {
              const isSelected =
                selectedWeek?.week === row.week && selectedWeek?.year === row.year;
              return (
                <Cell
                  key={`${row.year}-${row.week}`}
                  fill={isSelected ? chartColors.accentHover : chartColors.accent}
                  stroke={isSelected ? chartColors.ink : "none"}
                  strokeWidth={isSelected ? 2 : 0}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
