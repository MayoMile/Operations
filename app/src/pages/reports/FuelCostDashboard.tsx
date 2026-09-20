import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { MetricTile } from "@/components/MetricTile";
import { getFuelCostDashboard } from "@/lib/api";
import { formatCurrency, formatDateOnly, weekToMonday } from "@/lib/format";
import { chartColors } from "@/theme/chartColors";
import type { FuelCostDashboardData } from "@/lib/types";

// Matches the flat estimate baked into Loads.fuel_cost.
const FALLBACK_ESTIMATE = 0.67;

const perMile = (v: number) => `$${v.toFixed(2)}`;
const cents = (v: number) => `${(v * 100).toFixed(1)}¢`;
const signedCents = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}¢`;

export function FuelCostDashboard({
  rangeStart,
  rangeEnd,
}: {
  rangeStart: string;
  rangeEnd: string;
}) {
  const [data, setData] = useState<FuelCostDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFuelCostDashboard()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const estimate = data?.variance[0]?.estimated_cost_per_mile ?? FALLBACK_ESTIMATE;

  // Variance rows joined with the raw pre-trip charge total per load.
  const loadRows = useMemo(() => {
    if (!data) return [];
    const charges = new Map(
      data.byLoad.map((r) => [`${r.load_number}|${r.freight_bill}`, r.total_pretrip_charges]),
    );
    return data.variance
      .map((v) => ({
        ...v,
        charges:
          charges.get(`${v.load_number}|${v.freight_bill}`) ?? v.cost_per_mile * v.total_miles,
      }))
      .sort((a, b) => b.variance_from_estimate - a.variance_from_estimate);
  }, [data]);

  const totals = useMemo(() => {
    const charges = loadRows.reduce((s, r) => s + r.charges, 0);
    const miles = loadRows.reduce((s, r) => s + r.total_miles, 0);
    const actual = miles > 0 ? charges / miles : 0;
    return { charges, miles, actual, gap: actual - estimate };
  }, [loadRows, estimate]);

  const weeklyData = useMemo(() => {
    if (!data) return [];
    const rpmByWeek = new Map(
      data.weeklyRpm.map((r) => [`${r.week_year}-${r.week_number}`, r.avg_rpm]),
    );
    return data.weekly
      .filter((w) => {
        const monday = weekToMonday(w.week_number, w.week_year);
        if (rangeStart && monday < rangeStart) return false;
        if (rangeEnd && monday > rangeEnd) return false;
        return true;
      })
      .map((w) => ({
        label: formatDateOnly(weekToMonday(w.week_number, w.week_year)),
        "Avg RPM": rpmByWeek.get(`${w.week_year}-${w.week_number}`) ?? null,
        "Actual Fuel Cost / Mile": w.weighted_cost_per_mile,
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

  if (loadRows.length === 0) {
    return (
      <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
        No loads with matching settlement fuel charges yet.
      </p>
    );
  }

  const overEstimate = totals.gap > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile
          label="Actual Fuel Cost / Mile"
          value={perMile(totals.actual)}
          hint={`${formatCurrency(totals.charges)} over ${totals.miles.toLocaleString()} mi`}
        />
        <MetricTile
          label="Estimated Cost / Mile"
          value={perMile(estimate)}
          hint="Flat rate used in Loads.fuel_cost"
        />
        <MetricTile
          label="Actual vs. Estimate"
          value={signedCents(totals.gap)}
          tone={overEstimate ? "negative" : "positive"}
          hint={overEstimate ? "Spending more than estimated" : "Spending less than estimated"}
        />
        <MetricTile
          label="Loads With Fuel Data"
          value={String(loadRows.length)}
          hint="Loads matched to settlement charges"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="RPM vs. Actual Fuel Cost per Mile"
          subtitle={`Gap between the lines is real margin · Dashed = $${estimate.toFixed(2)} estimate`}
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, "dataMax + 0.5"]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={((v: number | string) => `$${Number(v).toFixed(2)}`) as never} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="Avg RPM"
                stroke={chartColors.accent}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="Actual Fuel Cost / Mile"
                stroke={chartColors.navy}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <ReferenceLine
                y={estimate}
                stroke={chartColors.warning}
                strokeDasharray="4 4"
                label={{ value: "Estimate", fontSize: 11, position: "insideTopRight" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Per-Load Variance From Estimate"
          subtitle="Cents per mile · Red = cost more than estimated · Green = cost less"
        >
          <ResponsiveContainer width="100%" height={Math.max(280, loadRows.length * 22)}>
            <BarChart data={loadRows} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}¢`}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="category" dataKey="load_number" width={90} tick={{ fontSize: 11 }} />
              <Tooltip formatter={((v: number | string) => signedCents(Number(v))) as never} />
              <ReferenceLine x={0} stroke={chartColors.grid} />
              <Bar dataKey="variance_from_estimate" name="Variance">
                {loadRows.map((r) => (
                  <Cell
                    key={`${r.load_number}-${r.freight_bill}`}
                    fill={r.variance_from_estimate > 0 ? chartColors.negative : chartColors.positive}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Fuel Cost by Load"
        subtitle="Every CARD PRE-TRIP settlement charge counted as fuel, matched to loads by freight bill · Highest overage first"
      >
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-body text-xs uppercase tracking-wide text-ink-muted dark:border-dark-border dark:text-dark-ink-muted">
                <th className="py-1.5 pr-3 font-medium">Load #</th>
                <th className="py-1.5 pr-3 text-right font-medium">Miles</th>
                <th className="py-1.5 pr-3 text-right font-medium">Fuel Charges</th>
                <th className="py-1.5 pr-3 text-right font-medium">Actual / Mi</th>
                <th className="py-1.5 pr-3 text-right font-medium">Estimate / Mi</th>
                <th className="py-1.5 text-right font-medium">Variance</th>
              </tr>
            </thead>
            <tbody>
              {loadRows.map((r) => (
                <tr
                  key={`${r.load_number}-${r.freight_bill}`}
                  className="border-b border-border last:border-0 dark:border-dark-border"
                >
                  <td className="py-1.5 pr-3 font-mono text-ink dark:text-dark-ink">{r.load_number}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink-muted dark:text-dark-ink-muted">
                    {r.total_miles.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink dark:text-dark-ink">
                    {formatCurrency(r.charges)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink dark:text-dark-ink">
                    {cents(r.cost_per_mile)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-ink-muted dark:text-dark-ink-muted">
                    {cents(r.estimated_cost_per_mile)}
                  </td>
                  <td
                    className={`py-1.5 text-right font-mono font-medium ${
                      r.variance_from_estimate > 0 ? "text-negative" : "text-positive"
                    }`}
                  >
                    {signedCents(r.variance_from_estimate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
