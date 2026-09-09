import { MetricTile } from "./MetricTile";
import { formatCurrency, formatMiles, formatRPM } from "@/lib/format";
import type { LoadsSummary } from "@/lib/types";

export function SummaryPanel({ summary }: { summary: LoadsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <MetricTile label="Total Loads" value={summary.totalLoads.toLocaleString()} />
      <MetricTile label="Total Miles" value={formatMiles(summary.totalMiles)} />
      <MetricTile
        label="Total Revenue"
        value={formatCurrency(summary.totalRevenue)}
        tone="positive"
      />
      <MetricTile label="Weighted RPM" value={formatRPM(summary.weightedRPM)} />
      <MetricTile
        label="Avg Deadhead"
        value={formatMiles(summary.avgDeadheadMiles)}
      />
    </div>
  );
}
