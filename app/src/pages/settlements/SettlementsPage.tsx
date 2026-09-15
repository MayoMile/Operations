import { useEffect, useState } from "react";
import { getSettlementDates, getSettlementStatement } from "@/lib/api";
import { formatCurrency, formatDate, formatLocation } from "@/lib/format";
import type { SettlementDateSummary, SettlementGroup, SettlementStatement } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { MetricTile } from "@/components/MetricTile";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";

const CATEGORY_LABELS: Record<string, string> = {
  line_haul: "Line Haul",
  fuel_surcharge: "Fuel Surcharge",
  pt_to_truck: "PT to Truck",
  card_fee: "Card Fee",
  truck_stop_scan: "Truck Stop Scan",
  card_pretrip: "Card Pre-Trip",
  other: "Other",
};

function categoryLabel(category: string | null): string {
  if (!category) return "Other";
  return CATEGORY_LABELS[category] ?? category;
}

function lineTypeTone(lineType: string): "positive" | "negative" | "neutral" {
  if (lineType === "revenue") return "positive";
  if (lineType === "reversal" || lineType === "deduction") return "negative";
  return "neutral";
}

/** Revenue vs. everything that reduces it (deductions and reversals both
 * count against the load the same way here) for a single group's header. */
function groupTotals(group: SettlementGroup): { revenue: number; deduction: number } {
  let revenue = 0;
  let deduction = 0;
  for (const line of group.lines) {
    if (line.line_type === "revenue") revenue += line.amount;
    else deduction += line.amount;
  }
  return { revenue, deduction };
}

export function SettlementsPage() {
  const [dates, setDates] = useState<SettlementDateSummary[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statement, setStatement] = useState<SettlementStatement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSettlementDates()
      .then((res) => {
        setDates(res.statements);
        if (res.statements.length > 0) setSelectedDate(res.statements[0].statement_date);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setStatement(null);
    getSettlementStatement(selectedDate)
      .then((res) => !cancelled && setStatement(res))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const currentIndex = dates?.findIndex((d) => d.statement_date === selectedDate) ?? -1;
  const hasOlder = dates ? currentIndex < dates.length - 1 && currentIndex >= 0 : false;
  const hasNewer = currentIndex > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settlements"
        subtitle="Agency settlement statements — revenue, deductions, and corrections as issued"
        actions={
          dates &&
          dates.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                disabled={!hasOlder}
                onClick={() => dates && setSelectedDate(dates[currentIndex + 1].statement_date)}
                className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium disabled:opacity-40 dark:border-dark-border dark:text-dark-ink"
              >
                Older
              </button>
              <select
                value={selectedDate ?? ""}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-1.5 font-body text-xs font-medium dark:border-dark-border dark:bg-dark-surface dark:text-dark-ink"
              >
                {[...dates]
                  .reverse()
                  .map((d) => (
                    <option key={d.statement_date} value={d.statement_date}>
                      {formatDate(d.statement_date)}
                    </option>
                  ))}
              </select>
              <button
                disabled={!hasNewer}
                onClick={() => dates && setSelectedDate(dates[currentIndex - 1].statement_date)}
                className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium disabled:opacity-40 dark:border-dark-border dark:text-dark-ink"
              >
                Newer
              </button>
            </div>
          )
        }
      />

      {error && <p className="font-body text-sm text-negative">{error}</p>}

      {!dates && !error && (
        <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading…</p>
      )}

      {dates && dates.length === 0 && (
        <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
          No settlement statements on file yet.
        </p>
      )}

      {statement && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricTile label="Total Revenue" value={formatCurrency(statement.summary.total_revenue)} tone="positive" />
            <MetricTile
              label="Reversals"
              value={statement.summary.total_reversals > 0 ? `-${formatCurrency(statement.summary.total_reversals)}` : formatCurrency(0)}
              tone={statement.summary.total_reversals > 0 ? "negative" : "neutral"}
            />
            <MetricTile
              label="Deductions"
              value={statement.summary.total_deductions > 0 ? `-${formatCurrency(statement.summary.total_deductions)}` : formatCurrency(0)}
              tone={statement.summary.total_deductions > 0 ? "negative" : "neutral"}
            />
            <MetricTile label="Net Total" value={formatCurrency(statement.summary.net_total)} />
          </div>

          <Card>
            <h4 className="mb-3 text-sm text-ink dark:text-dark-ink">Deductions by Category</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statement.summary.by_category)
                .filter(([, amount]) => amount < 0)
                .sort((a, b) => a[1] - b[1])
                .map(([category, amount]) => (
                  <StatusBadge key={category} tone="negative">
                    {categoryLabel(category)}: {formatCurrency(amount)}
                  </StatusBadge>
                ))}
              {Object.values(statement.summary.by_category).every((a) => a >= 0) && (
                <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
                  No deductions on this statement.
                </p>
              )}
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            {statement.groups.map((group) => {
              const { revenue, deduction } = groupTotals(group);
              return (
              <Card key={`${group.agency_code}-${group.freight_bill}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-body text-sm font-semibold text-ink dark:text-dark-ink">
                      {group.load_number ?? `Freight Bill ${group.freight_bill}`}
                      <span className="ml-2 font-body text-xs font-normal text-ink-muted dark:text-dark-ink-muted">
                        {group.agency_code} · {group.freight_bill}
                      </span>
                    </p>
                    {group.load_number ? (
                      <p className="mt-0.5 font-body text-xs text-ink-muted dark:text-dark-ink-muted">
                        {formatLocation(group.pickup_location)} → {formatLocation(group.delivery_location)}
                      </p>
                    ) : (
                      <p className="mt-0.5 font-body text-xs italic text-ink-faint dark:text-dark-ink-muted">
                        No matching load on file
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-ink-muted dark:text-dark-ink-muted">
                      Revenue <span className="text-positive">{formatCurrency(revenue)}</span>
                    </p>
                    <p className="font-mono text-xs text-ink-muted dark:text-dark-ink-muted">
                      Deductions <span className="text-negative">-{formatCurrency(deduction)}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold text-ink dark:text-dark-ink">
                      {formatCurrency(group.net_amount)}
                    </p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left font-body text-xs uppercase tracking-wide text-ink-muted dark:border-dark-border dark:text-dark-ink-muted">
                      <th className="py-1.5 pr-3 font-medium">Date</th>
                      <th className="py-1.5 pr-3 font-medium">Description</th>
                      <th className="py-1.5 pr-3 font-medium">Category</th>
                      <th className="py-1.5 pr-3 text-right font-medium">Type</th>
                      <th className="py-1.5 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.map((line) => (
                      <tr key={line.id} className="border-b border-border last:border-0 dark:border-dark-border">
                        <td className="py-1.5 pr-3 font-mono text-xs text-ink-muted dark:text-dark-ink-muted">
                          {line.entry_date ? formatDate(line.entry_date) : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-ink dark:text-dark-ink">{line.description ?? "—"}</td>
                        <td className="py-1.5 pr-3 text-ink-muted dark:text-dark-ink-muted">{categoryLabel(line.category)}</td>
                        <td className="py-1.5 pr-3 text-right">
                          <StatusBadge tone={lineTypeTone(line.line_type)}>{line.line_type}</StatusBadge>
                        </td>
                        <td className="py-1.5 text-right font-mono text-ink dark:text-dark-ink">
                          {formatCurrency(line.signed_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
