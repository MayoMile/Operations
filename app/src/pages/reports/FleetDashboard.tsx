import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/ChartCard";
import { getFleetDashboard } from "@/lib/api";
import { formatDateOnly, weekToMonday } from "@/lib/format";
import { chartColors } from "@/theme/chartColors";
import type { FleetDashboardData } from "@/lib/types";

export function FleetDashboard({
  rangeStart,
  rangeEnd,
}: {
  rangeStart: string;
  rangeEnd: string;
}) {
  const [data, setData] = useState<FleetDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFleetDashboard()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const idleTimeData = useMemo(() => {
    if (!data) return [];
    return data.truckIdleTime
      .filter((r) => {
        const d = r.this_delivery.slice(0, 10);
        if (rangeStart && d < rangeStart) return false;
        if (rangeEnd && d > rangeEnd) return false;
        return true;
      })
      .slice(-20)
      .map((r) => ({
        label: r.load_number,
        "Idle Hours": r.idle_hours_until_next_load ?? 0,
      }));
  }, [data, rangeStart, rangeEnd]);

  const fscRatioData = useMemo(() => {
    if (!data) return [];
    return data.fuelSurchargeRatioByWeek
      .filter((w) => {
        const monday = weekToMonday(w.week_number, w.week_year);
        if (rangeStart && monday < rangeStart) return false;
        if (rangeEnd && monday > rangeEnd) return false;
        return true;
      })
      .map((w) => ({
        label: formatDateOnly(weekToMonday(w.week_number, w.week_year)),
        "FSC per Mile": w.fuel_surcharge_per_mile,
      }));
  }, [data, rangeStart, rangeEnd]);

  const haulLengthData = useMemo(() => {
    if (!data) return [];
    return data.haulLengthComparison.map((h) => ({
      name: h.haul_length_category,
      value: h.load_count,
    }));
  }, [data]);

  const agencyData = useMemo(() => {
    if (!data) return [];
    return [...data.agencyPerformance]
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .map((a) => ({
        label: a.agency_name,
        Revenue: a.total_revenue,
        rpm: a.avg_rpm,
      }));
  }, [data]);

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
      <ChartCard
        title="Truck Idle Time"
        subtitle="Hours idle between delivery and next pickup (most recent 20)"
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={idleTimeData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={((v: number | string) => `${v} hrs`) as never} />
            <Bar dataKey="Idle Hours" fill={chartColors.accent} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Fuel Surcharge Recovery" subtitle="FSC collected per mile, by week">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={fscRatioData}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={((v: number | string) => `$${Number(v).toFixed(3)}/mi`) as never} />
            <Line
              type="monotone"
              dataKey="FSC per Mile"
              stroke={chartColors.positive}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Haul Length Distribution" subtitle="Load count by trip-distance bucket · all-time">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={haulLengthData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              label={(entry) => `${entry.name}: ${entry.value}`}
              labelLine={false}
            >
              {haulLengthData.map((_, i) => (
                <Cell key={i} fill={chartColors.series[i % chartColors.series.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Agency Performance"
        subtitle="Total revenue by booking source · all-time (hover for avg RPM)"
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={agencyData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} opacity={0.2} />
            <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={((value: number, name: string, item: { payload?: { rpm?: number | null } }) => {
                const rpm = item.payload?.rpm;
                return [
                  `$${Number(value).toLocaleString()}${rpm ? ` · avg RPM $${Number(rpm).toFixed(2)}` : ""}`,
                  name,
                ];
              }) as never}
            />
            <Bar dataKey="Revenue" fill={chartColors.accent} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
