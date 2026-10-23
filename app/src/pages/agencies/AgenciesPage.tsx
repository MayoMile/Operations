import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { MetricTile } from "@/components/MetricTile";
import { getAgencies } from "@/lib/api";
import { formatCurrency, formatDate, formatPercent, formatRPM } from "@/lib/format";
import type { AgenciesListResponse, AgencySummary } from "@/lib/types";

// Recharts is a large dependency only the comparison chart needs — code-split
// it out of the main bundle the same way Reports and Loads do.
const AgencyRpmChart = lazy(() =>
  import("./AgencyRpmChart").then((m) => ({ default: m.AgencyRpmChart })),
);

// Most agencies have only a handful of loads, so one load can swing every
// average. Below this many loads the numbers are shown greyed out.
const LOW_SAMPLE = 3;

export function AgenciesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AgenciesListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chartMinLoads, setChartMinLoads] = useState(2);

  useEffect(() => {
    getAgencies()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.agencies;
    return data.agencies.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.codes.some((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const chartAgencies = useMemo(
    () => (data ? data.agencies.filter((a) => a.load_count >= chartMinLoads) : []),
    [data, chartMinLoads],
  );

  const muted = (a: AgencySummary) =>
    a.load_count < LOW_SAMPLE ? "text-ink-faint dark:text-dark-ink-muted" : "";

  const columns: Column<AgencySummary>[] = [
    {
      key: "name",
      header: "Agency",
      render: (a) => (
        <span>
          {a.name}
          <span className="ml-2 font-mono text-xs text-ink-faint dark:text-dark-ink-muted">
            {a.codes.map((c) => c.code).join(" · ")}
          </span>
        </span>
      ),
      sortValue: (a) => a.name,
    },
    {
      key: "load_count",
      header: "Loads",
      align: "right",
      render: (a) => <span className="font-mono">{a.load_count}</span>,
      sortValue: (a) => a.load_count,
    },
    {
      key: "total_revenue",
      header: "Revenue",
      align: "right",
      render: (a) => <span className="font-mono">{formatCurrency(a.total_revenue)}</span>,
      sortValue: (a) => a.total_revenue,
    },
    {
      key: "weighted_rpm",
      header: "RPM",
      align: "right",
      render: (a) => <span className={`font-mono ${muted(a)}`}>{formatRPM(a.weighted_rpm)}</span>,
      sortValue: (a) => a.weighted_rpm,
    },
    {
      key: "deadhead_pct",
      header: "Deadhead %",
      align: "right",
      render: (a) => <span className={`font-mono ${muted(a)}`}>{formatPercent(a.deadhead_pct)}</span>,
      sortValue: (a) => a.deadhead_pct,
    },
    {
      key: "last_load_date",
      header: "Last Load",
      render: (a) => formatDate(a.last_load_date),
      sortValue: (a) => (a.last_load_date ? new Date(a.last_load_date).getTime() : null),
    },
    {
      key: "contact_count",
      header: "Contacts",
      align: "right",
      render: (a) => <span className="font-mono">{a.contact_count}</span>,
      sortValue: (a) => a.contact_count,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agencies"
        subtitle="Everyone you haul for · agencies sharing a phone or email are combined"
      />

      {error && (
        <p className="rounded-md bg-negative-muted p-3 font-body text-sm text-negative">{error}</p>
      )}

      {!data && !error && (
        <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading…</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricTile label="Agencies" value={String(data.agencies.length)} />
            <MetricTile
              label="Agencies With Loads"
              value={String(data.agencies.filter((a) => a.load_count > 0).length)}
            />
            <MetricTile label="Overall RPM" value={formatRPM(data.overall.weighted_rpm)} />
            <MetricTile label="Overall Deadhead" value={formatPercent(data.overall.deadhead_pct)} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">
                Chart shows
              </label>
              <select
                value={chartMinLoads}
                onChange={(e) => setChartMinLoads(Number(e.target.value))}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
              >
                <option value={1}>All agencies with loads</option>
                <option value={2}>Agencies with 2+ loads</option>
                <option value={3}>Agencies with 3+ loads</option>
              </select>
            </div>
            <Suspense
              fallback={
                <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading chart…</p>
              }
            >
              <AgencyRpmChart agencies={chartAgencies} overallRpm={data.overall.weighted_rpm} />
            </Suspense>
          </div>

          <div className="flex flex-col gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by agency name or code"
              className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
            />
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(a) => a.id}
              onRowClick={(a) => navigate(`/agencies/${encodeURIComponent(a.id)}`)}
              emptyMessage="No agencies match your search."
            />
            <p className="font-body text-xs text-ink-faint dark:text-dark-ink-muted">
              Greyed-out numbers come from fewer than {LOW_SAMPLE} loads — treat them as rough.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
