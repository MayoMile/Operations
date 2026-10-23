import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/ChartCard";
import { chartColors } from "@/theme/chartColors";
import type { AgencySummary } from "@/lib/types";

export function AgencyRpmChart({
  agencies,
  overallRpm,
}: {
  agencies: AgencySummary[];
  overallRpm: number | null;
}) {
  const data = agencies
    .filter((a) => a.weighted_rpm !== null)
    .map((a) => ({
      label: `${a.name} (${a.load_count})`,
      rpm: a.weighted_rpm as number,
    }))
    .sort((a, b) => b.rpm - a.rpm);

  return (
    <ChartCard
      title="RPM by Agency"
      subtitle="Mile-weighted RPM including deadhead · Green = at or above the overall average · (n) = loads"
    >
      {data.length === 0 ? (
        <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
          No agencies match this filter.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis
              type="number"
              domain={[0, "dataMax + 0.5"]}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              tick={{ fontSize: 11 }}
            />
            <YAxis type="category" dataKey="label" width={230} tick={{ fontSize: 11 }} />
            <Tooltip formatter={((v: number | string) => `$${Number(v).toFixed(2)}`) as never} />
            {overallRpm !== null && (
              <ReferenceLine
                x={overallRpm}
                stroke={chartColors.warning}
                strokeDasharray="4 4"
                label={{ value: `Overall $${overallRpm.toFixed(2)}`, fontSize: 11, position: "top" }}
              />
            )}
            <Bar dataKey="rpm" name="RPM">
              {data.map((d) => (
                <Cell
                  key={d.label}
                  fill={overallRpm !== null && d.rpm < overallRpm ? chartColors.negative : chartColors.positive}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
