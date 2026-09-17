import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/ChartCard";
import { getExecutiveDashboard } from "@/lib/api";
import { formatDateOnly, weekToMonday } from "@/lib/format";
import { chartColors } from "@/theme/chartColors";
import type { ExecutiveDashboardData } from "@/lib/types";

const TARGET_RPM = 2.5;
const RPM_THRESHOLDS = [2.5, 2.7, 2.9, 3.0, 3.25, 3.5];

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function currencyTick(v: number) {
  return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
}

export function ExecutiveDashboard({
  rangeStart,
  rangeEnd,
}: {
  rangeStart: string;
  rangeEnd: string;
}) {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getExecutiveDashboard()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const weeklyChartData = useMemo(() => {
    if (!data) return [];
    return data.weeklyTotals
      .filter((w) => {
        const monday = weekToMonday(w.week_number, w.week_year);
        if (rangeStart && monday < rangeStart) return false;
        if (rangeEnd && monday > rangeEnd) return false;
        return true;
      })
      .map((w) => ({
        label: formatDateOnly(weekToMonday(w.week_number, w.week_year)),
        "Line Haul": w.total_line_haul,
        "Fuel Surcharge": w.total_fuel_surcharge,
        Accessorials: w.total_accessorials,
      }));
  }, [data, rangeStart, rangeEnd]);

  const monthlyChartData = useMemo(() => {
    if (!data) return [];
    return data.monthlyRevenue
      .filter((m) => {
        const firstOfMonth = `${m.year}-${String(m.month).padStart(2, "0")}-01`;
        const lastOfMonth = `${m.year}-${String(m.month).padStart(2, "0")}-28`;
        if (rangeStart && lastOfMonth < rangeStart) return false;
        if (rangeEnd && firstOfMonth > rangeEnd) return false;
        return true;
      })
      .map((m) => ({
        label: `${MONTH_NAMES[m.month - 1]} ${m.year}`,
        "Line Haul": m.total_line_haul,
        "Fuel Surcharge": m.total_fuel_surcharge,
        Accessorials: m.total_accessorials,
      }));
  }, [data, rangeStart, rangeEnd]);

  const profitRpmData = useMemo(() => {
    if (!data) return [];
    const rpmByWeek = new Map(
      data.weeklyRpmSummary.map((r) => [`${r.week_year}-${r.week_number}`, r.avg_rpm]),
    );
    return data.weeklyProfitability
      .filter((w) => {
        const monday = weekToMonday(w.week_number, w.week_year);
        if (rangeStart && monday < rangeStart) return false;
        if (rangeEnd && monday > rangeEnd) return false;
        return true;
      })
      .map((w) => ({
        label: formatDateOnly(weekToMonday(w.week_number, w.week_year)),
        "Net Profit": w.net_profit_before_other_expenses,
        "Avg RPM": rpmByWeek.get(`${w.week_year}-${w.week_number}`) ?? null,
      }));
  }, [data, rangeStart, rangeEnd]);

  const rpmTrendData = useMemo(() => {
    if (!data) return [];
    return data.weeklyRpmSummary
      .filter((w) => {
        const monday = weekToMonday(w.week_number, w.week_year);
        if (rangeStart && monday < rangeStart) return false;
        if (rangeEnd && monday > rangeEnd) return false;
        return true;
      })
      .map((w) => ({
        label: formatDateOnly(weekToMonday(w.week_number, w.week_year)),
        "Avg RPM": w.avg_rpm,
      }));
  }, [data, rangeStart, rangeEnd]);

  const rpmThresholdData = useMemo(() => {
    if (!data) return [];
    const filtered = data.loadRpm.filter((r) => {
      const pickupDate = r.pickup_date.slice(0, 10);
      if (rangeStart && pickupDate < rangeStart) return false;
      if (rangeEnd && pickupDate > rangeEnd) return false;
      return true;
    });
    return RPM_THRESHOLDS.map((threshold) => ({
      label: `≥ $${threshold.toFixed(2)}`,
      Loads: filtered.filter((r) => r.RPM >= threshold).length,
    }));
  }, [data, rangeStart, rangeEnd]);

  if (error) {
    return (
      <p className="rounded-md bg-negative-muted p-3 font-body text-sm text-negative">{error}</p>
    );
  }

  if (!data) {
    return <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading…</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Revenue Composition — Weekly" subtitle="Line haul, fuel surcharge, and accessorials">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={weeklyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11 }} />
            <Tooltip formatter={((v: number | string) => `$${Number(v).toLocaleString()}`) as never} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Line Haul" stackId="rev" fill={chartColors.accent} />
            <Bar dataKey="Fuel Surcharge" stackId="rev" fill={chartColors.positive} />
            <Bar dataKey="Accessorials" stackId="rev" fill={chartColors.series[2]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Revenue Composition — Monthly" subtitle="Line haul, fuel surcharge, and accessorials">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11 }} />
            <Tooltip formatter={((v: number | string) => `$${Number(v).toLocaleString()}`) as never} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Line Haul" stackId="rev" fill={chartColors.accent} />
            <Bar dataKey="Fuel Surcharge" stackId="rev" fill={chartColors.positive} />
            <Bar dataKey="Accessorials" stackId="rev" fill={chartColors.series[2]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Net Weekly Profit vs. RPM"
        subtitle={`Bars = net profit · Line = avg RPM · Dashed = $${TARGET_RPM.toFixed(2)} target`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={profitRpmData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="profit" tickFormatter={currencyTick} tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="rpm"
              orientation="right"
              domain={[0, "dataMax + 1"]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="profit" dataKey="Net Profit" fill={chartColors.accentMuted} stroke={chartColors.accent} />
            <Line
              yAxisId="rpm"
              type="monotone"
              dataKey="Avg RPM"
              stroke={chartColors.positive}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <ReferenceLine
              yAxisId="rpm"
              y={TARGET_RPM}
              stroke={chartColors.warning}
              strokeDasharray="4 4"
              label={{ value: `Target $${TARGET_RPM.toFixed(2)}`, fontSize: 11, position: "insideTopRight" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="RPM Trend" subtitle="Average rate per mile by week">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rpmTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, "dataMax + 1"]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={((v: number | string) => `$${Number(v).toFixed(2)}`) as never} />
            <Line
              type="monotone"
              dataKey="Avg RPM"
              stroke={chartColors.accent}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <ReferenceLine
              y={TARGET_RPM}
              stroke={chartColors.warning}
              strokeDasharray="4 4"
              label={{ value: "Target", fontSize: 11, position: "insideTopRight" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Loads by RPM Threshold" subtitle="Count of loads at or above each rate per mile">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rpmThresholdData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="Loads" fill={chartColors.accent} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
