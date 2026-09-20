import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { formatDateOnly } from "@/lib/format";
import { ExecutiveDashboard } from "./ExecutiveDashboard";
import { FleetDashboard } from "./FleetDashboard";
import { FuelCostDashboard } from "./FuelCostDashboard";
import { DataQualityDashboard } from "./DataQualityDashboard";

type DashboardTab = "executive" | "fleet" | "fuel" | "quality";

const TABS: { key: DashboardTab; label: string }[] = [
  { key: "executive", label: "Executive Performance" },
  { key: "fleet", label: "Fleet Efficiency" },
  { key: "fuel", label: "Fuel Cost" },
  { key: "quality", label: "Data Quality" },
];

export function ReportsPage() {
  const [tab, setTab] = useState<DashboardTab>("executive");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const activeRangeLabel =
    rangeStart && rangeEnd
      ? `${formatDateOnly(rangeStart)} – ${formatDateOnly(rangeEnd)}`
      : rangeStart
        ? `From ${formatDateOnly(rangeStart)}`
        : rangeEnd
          ? `Through ${formatDateOnly(rangeEnd)}`
          : "All time";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" subtitle="Analytics across weekly, fleet, and data-quality views" />

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 dark:border-dark-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 font-body text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-accent-muted text-accent-hover dark:bg-dark-surface-muted dark:text-accent"
                : "text-ink-muted hover:bg-surface-muted dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4 dark:border-dark-border dark:bg-dark-surface">
        <div className="flex flex-col gap-1">
          <label className="font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">
            Week/Month Date Range
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
            />
            <span className="text-ink-faint dark:text-dark-ink-muted">–</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
            />
            {(rangeStart || rangeEnd) && (
              <button
                onClick={() => {
                  setRangeStart("");
                  setRangeEnd("");
                }}
                className="rounded-md border border-border px-2.5 py-1.5 font-body text-xs font-medium text-ink-muted hover:bg-surface-muted dark:border-dark-border dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="font-mono text-xs text-ink-muted dark:text-dark-ink-muted">
          {activeRangeLabel}
        </p>
        <p className="ml-auto max-w-xs text-right font-body text-xs text-ink-faint dark:text-dark-ink-muted">
          Applies to week/month-based charts below. Agency, haul-length, and data-quality views are
          all-time or current-state and aren't date-filtered.
        </p>
      </div>

      {tab === "executive" && <ExecutiveDashboard rangeStart={rangeStart} rangeEnd={rangeEnd} />}
      {tab === "fleet" && <FleetDashboard rangeStart={rangeStart} rangeEnd={rangeEnd} />}
      {tab === "fuel" && <FuelCostDashboard rangeStart={rangeStart} rangeEnd={rangeEnd} />}
      {tab === "quality" && <DataQualityDashboard />}
    </div>
  );
}
