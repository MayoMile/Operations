import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { SummaryPanel } from "@/components/SummaryPanel";
import { WeeklySettlementPanel } from "@/components/WeeklySettlementPanel";
import { MetricTile } from "@/components/MetricTile";
import { Card } from "@/components/Card";
import {
  getLoads,
  getLoadsForWeek,
  getMostRecentLoad,
  getWeeklyProfitability,
  getWeeklyTotals,
  searchLoads,
} from "@/lib/api";
import { computeSummary } from "@/lib/summary";
import { formatCurrency, formatDate, formatDateOnly, formatLocation, formatMiles, formatRPM, isoWeek, weekToMonday } from "@/lib/format";
import type { LoadSummary, LoadsSummary, MostRecentLoad, WeeklyProfitabilityRow, WeeklyTotalsRow } from "@/lib/types";
import { LoadDetailModal } from "./LoadDetailModal";

// Recharts is a large dependency the rest of Loads doesn't need — code-split
// it out of the main bundle the same way Reports does.
const WeekComparisonChart = lazy(() =>
  import("./WeekComparisonChart").then((m) => ({ default: m.WeekComparisonChart })),
);

type FilterMode = "all" | "search" | "week";

const PAGE_SIZE = 25;

export function LoadsPage() {
  const [mode, setMode] = useState<FilterMode>("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LoadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<LoadsSummary | null>(null);
  const [weeklyProfitability, setWeeklyProfitability] =
    useState<WeeklyProfitabilityRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoad, setSelectedLoad] = useState<string | null>(null);
  const [mostRecentLoad, setMostRecentLoad] = useState<MostRecentLoad | null>(null);
  const [weeklyTotals, setWeeklyTotals] = useState<WeeklyTotalsRow[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<{ week: number; year: number } | null>(null);
  // Bumped to force DataTable to remount, clearing its internal sort state.
  const [sortResetKey, setSortResetKey] = useState(0);

  // Server-query inputs (each triggers a fresh fetch, replacing the working set)
  const [searchText, setSearchText] = useState("");
  const currentIsoWeek = useMemo(() => isoWeek(new Date()), []);

  // Real-time client-side filters, applied together over whatever rows are
  // currently loaded — no server round-trip, no page reload.
  const [locationFilter, setLocationFilter] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const filteredRows = useMemo(() => {
    const loc = locationFilter.trim().toLowerCase();
    const num = searchText.trim().toLowerCase();
    return rows.filter((r) => {
      if (loc) {
        const matchesLocation =
          r.pickup_location.toLowerCase().includes(loc) ||
          r.delivery_location.toLowerCase().includes(loc);
        if (!matchesLocation) return false;
      }
      if (num && !r.load_number.toLowerCase().includes(num)) return false;
      const pickupDate = r.pickup_date.slice(0, 10);
      if (rangeStart && pickupDate < rangeStart) return false;
      if (rangeEnd && pickupDate > rangeEnd) return false;
      return true;
    });
  }, [rows, locationFilter, searchText, rangeStart, rangeEnd]);

  const activeRangeLabel =
    rangeStart && rangeEnd
      ? `${formatDateOnly(rangeStart)} – ${formatDateOnly(rangeEnd)}`
      : rangeStart
        ? `From ${formatDateOnly(rangeStart)}`
        : rangeEnd
          ? `Through ${formatDateOnly(rangeEnd)}`
          : "All dates";

  const hasQuickFilters = Boolean(
    locationFilter.trim() || searchText.trim() || rangeStart || rangeEnd,
  );

  // The metric boxes must reflect exactly what's in the table. `summary` is
  // fetched per-mode: for "all" it's a true all-time aggregate computed
  // server-side across every load (more accurate than the current page
  // alone), and for "search"/"week" it's computed from that mode's complete
  // result set. Neither accounts for the location/load#/date-range quick
  // filters layered on top — so once any of those are active, recompute
  // from exactly the rows the table is showing instead.
  const displaySummary = hasQuickFilters ? computeSummary(filteredRows) : summary;

  useEffect(() => {
    if (mode !== "all") return;
    setLoading(true);
    setError(null);
    getLoads(page, PAGE_SIZE)
      .then((data) => {
        setRows(data.rows);
        setTotal(data.total);
        setSummary(data.summary ?? computeSummary(data.rows));
        setWeeklyProfitability(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [mode, page]);

  useEffect(() => {
    getMostRecentLoad()
      .then(setMostRecentLoad)
      .catch(() => setMostRecentLoad(null));
    getWeeklyTotals()
      .then(setWeeklyTotals)
      .catch(() => setWeeklyTotals([]));
  }, []);

  /** Drives both the "This week" button and clicking a bar in the
   * week-comparison chart — fetches that week's loads, its settlement
   * panel, syncs the date-range inputs to that week's Mon–Sun, and tracks
   * `selectedWeek` so the chart can highlight the active bar. */
  async function runWeek(week: number, year: number) {
    setMode("week");
    setSelectedWeek({ week, year });
    setLoading(true);
    setError(null);
    try {
      const data = await getLoadsForWeek(week, year);
      setRows(data.rows);
      setTotal(data.rows.length);
      setSummary(computeSummary(data.rows));
      const profitability = await getWeeklyProfitability(week, year).catch(() => null);
      setWeeklyProfitability(profitability);
      // Reflect the selected week in the range inputs/label for clarity.
      const mondayStr = weekToMonday(week, year);
      const sunday = new Date(`${mondayStr}T00:00:00Z`);
      sunday.setUTCDate(sunday.getUTCDate() + 6);
      setRangeStart(mondayStr);
      setRangeEnd(sunday.toISOString().slice(0, 10));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function runThisWeek() {
    return runWeek(currentIsoWeek.week, currentIsoWeek.year);
  }

  /** Load-number box filters the current page instantly as you type; Enter
   * additionally searches the full load history server-side, in case the
   * match isn't on the currently loaded page. */
  async function runFullHistorySearch() {
    if (!searchText.trim()) return;
    setMode("search");
    setLoading(true);
    setError(null);
    try {
      const data = await searchLoads(searchText.trim());
      setRows(data.rows);
      setTotal(data.rows.length);
      setSummary(computeSummary(data.rows));
      setWeeklyProfitability(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  /** Picking a pickup (start) date jumps the delivery (end) date picker to
   * that same date whenever end is empty or would otherwise fall before
   * start, so the user only has to navigate forward, not back to June 1st
   * every time. Native <input type="date"> has no API to move a picker's
   * displayed month without also setting its value, so this pre-fills end
   * with start rather than leaving it blank — the user can still change it. */
  function handleRangeStartChange(value: string) {
    setRangeStart(value);
    if (value && (!rangeEnd || rangeEnd < value)) {
      setRangeEnd(value);
    }
  }

  function resetToAllLoads() {
    setMode("all");
    setPage(1);
    setSelectedWeek(null);
  }

  /** Resets every filter (date range, location, load-number, and sorting)
   * and explicitly returns to the full unfiltered "all loads" view. Setting
   * `mode` back to "all" is the important part — without it, clearing the
   * inputs after a search/week fetch left `rows` (and the table) stuck on
   * whatever that fetch last returned, including empty results. */
  function clearAllFilters() {
    setMode("all");
    setPage(1);
    setSelectedWeek(null);
    setLocationFilter("");
    setSearchText("");
    setRangeStart("");
    setRangeEnd("");
    setSortResetKey((k) => k + 1);
  }

  const columns: Column<LoadSummary>[] = [
    {
      key: "load_number",
      header: "Load #",
      render: (r) => r.load_number,
      sortValue: (r) => r.load_number,
    },
    {
      key: "agency_name",
      header: "Agency",
      render: (r) => r.agency_name,
      sortValue: (r) => r.agency_name,
    },
    {
      key: "pickup_date",
      header: "Pickup",
      render: (r) => formatDate(r.pickup_date),
      sortValue: (r) => new Date(r.pickup_date).getTime(),
    },
    {
      key: "pickup_location",
      header: "Pickup Location",
      render: (r) => formatLocation(r.pickup_location),
      sortValue: (r) => r.pickup_location,
    },
    {
      key: "delivery_date",
      header: "Delivery",
      render: (r) => formatDate(r.delivery_date),
      sortValue: (r) => new Date(r.delivery_date).getTime(),
    },
    {
      key: "delivery_location",
      header: "Delivery Location",
      render: (r) => formatLocation(r.delivery_location),
      sortValue: (r) => r.delivery_location,
    },
    {
      key: "loaded_miles",
      header: "Loaded Mi",
      align: "right",
      render: (r) => <span className="font-mono">{formatMiles(r.loaded_miles)}</span>,
      sortValue: (r) => r.loaded_miles,
    },
    {
      key: "deadhead",
      header: "Deadhead",
      align: "right",
      render: (r) => <span className="font-mono">{formatMiles(r.deadhead)}</span>,
      sortValue: (r) => r.deadhead,
    },
    {
      key: "total_miles",
      header: "Total Mi",
      align: "right",
      render: (r) => <span className="font-mono">{formatMiles(r.total_miles)}</span>,
      sortValue: (r) => r.total_miles,
    },
    {
      key: "gross_to_the_truck",
      header: "Gross",
      align: "right",
      render: (r) => (
        <span className="font-mono text-positive">
          {formatCurrency(r.gross_to_the_truck)}
        </span>
      ),
      sortValue: (r) => r.gross_to_the_truck,
    },
    {
      key: "RPM",
      header: "RPM",
      align: "right",
      render: (r) => <span className="font-mono">{formatRPM(r.RPM)}</span>,
      sortValue: (r) => r.RPM,
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Loads"
        subtitle={
          mode === "all"
            ? "All loads, most recent pickup first"
            : mode === "search"
              ? `Search results for "${searchText}"`
              : "This week"
        }
        actions={
          mode !== "all" ? (
            <button
              onClick={resetToAllLoads}
              className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium text-ink-muted hover:bg-surface-muted dark:border-dark-border dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
            >
              Back to all loads
            </button>
          ) : undefined
        }
      />

      {mostRecentLoad && (
        <Card>
          <p className="mb-3 font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">
            Most Recent Load
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricTile label="Pickup Location" value={formatLocation(mostRecentLoad.pickup_location)} />
            <MetricTile label="Drop Location" value={formatLocation(mostRecentLoad.delivery_location)} />
            <MetricTile
              label="Date"
              value={`${formatDate(mostRecentLoad.pickup_date)} → ${formatDate(mostRecentLoad.delivery_date)}`}
            />
            <MetricTile
              label="Gross Pay"
              value={formatCurrency(mostRecentLoad.gross_to_the_truck)}
              tone="positive"
            />
            <MetricTile label="RPM" value={formatRPM(mostRecentLoad.RPM)} />
          </div>
        </Card>
      )}

      {weeklyTotals.length > 0 && (
        <Suspense
          fallback={
            <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading chart…</p>
          }
        >
          <WeekComparisonChart
            weeklyTotals={weeklyTotals}
            selectedWeek={selectedWeek}
            onSelectWeek={runWeek}
          />
        </Suspense>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 dark:border-dark-border dark:bg-dark-surface sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">
            Pickup Date Range
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => handleRangeStartChange(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
            />
            <span className="text-ink-faint dark:text-dark-ink-muted">–</span>
            <input
              type="date"
              value={rangeEnd}
              min={rangeStart || undefined}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
            />
            <button
              onClick={runThisWeek}
              className="rounded-md border border-border px-2.5 py-1.5 font-body text-xs font-medium text-ink-muted hover:bg-surface-muted dark:border-dark-border dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
            >
              This week
            </button>
          </div>
          <p className="font-mono text-xs text-ink-muted dark:text-dark-ink-muted">
            {activeRangeLabel}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">
            Filter by City or State
          </label>
          <input
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="e.g. Dallas or TX"
            className="w-44 rounded-md border border-border bg-surface px-2 py-1.5 text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">
            Search by Load #
          </label>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runFullHistorySearch()}
            placeholder="e.g. 450 or ML-10234"
            className="w-40 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink"
          />
          <p className="font-body text-[11px] text-ink-faint dark:text-dark-ink-muted">
            Filters instantly · Enter searches all history
          </p>
        </div>

        <button
          onClick={clearAllFilters}
          className="rounded-md bg-accent px-4 py-1.5 font-body text-xs font-semibold text-white hover:bg-accent-hover"
        >
          Clear Filters
        </button>
      </div>

      {displaySummary && <SummaryPanel summary={displaySummary} />}

      {mode === "week" && weeklyProfitability && (
        <WeeklySettlementPanel data={weeklyProfitability} />
      )}

      {error && (
        <p className="rounded-md bg-negative-muted p-3 font-body text-sm text-negative">
          {error}
        </p>
      )}

      <DataTable
        key={sortResetKey}
        columns={columns}
        rows={filteredRows}
        rowKey={(r) => r.load_number}
        onRowClick={(r) => setSelectedLoad(r.load_number)}
        emptyMessage={
          loading ? "Loading…" : hasQuickFilters ? "No loads match the current filters." : "No loads found."
        }
      />

      {mode === "all" && (
        <div className="flex items-center justify-between">
          <span className="font-body text-xs text-ink-muted dark:text-dark-ink-muted">
            Page {page} of {totalPages} ({total.toLocaleString()} loads)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium disabled:opacity-40 dark:border-dark-border dark:text-dark-ink"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium disabled:opacity-40 dark:border-dark-border dark:text-dark-ink"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedLoad && (
        <LoadDetailModal loadNumber={selectedLoad} onClose={() => setSelectedLoad(null)} />
      )}
    </div>
  );
}
