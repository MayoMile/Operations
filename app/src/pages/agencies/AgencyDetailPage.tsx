import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { DataTable, type Column } from "@/components/DataTable";
import { MetricTile } from "@/components/MetricTile";
import { getAgency } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  formatLocation,
  formatMiles,
  formatPercent,
  formatPhone,
  formatRPM,
} from "@/lib/format";
import type { AgencyDetailResponse, LoadSummary } from "@/lib/types";
import { LoadDetailModal } from "../loads/LoadDetailModal";

const LOW_SAMPLE = 3;

const loadColumns: Column<LoadSummary>[] = [
  { key: "load_number", header: "Load #", render: (r) => r.load_number, sortValue: (r) => r.load_number },
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
    key: "delivery_location",
    header: "Delivery Location",
    render: (r) => formatLocation(r.delivery_location),
    sortValue: (r) => r.delivery_location,
  },
  {
    key: "deadhead",
    header: "Deadhead",
    align: "right",
    render: (r) => <span className="font-mono">{formatMiles(r.deadhead)}</span>,
    sortValue: (r) => r.deadhead,
  },
  {
    key: "loaded_miles",
    header: "Loaded Mi",
    align: "right",
    render: (r) => <span className="font-mono">{formatMiles(r.loaded_miles)}</span>,
    sortValue: (r) => r.loaded_miles,
  },
  {
    key: "gross_to_the_truck",
    header: "Gross",
    align: "right",
    render: (r) => <span className="font-mono text-positive">{formatCurrency(r.gross_to_the_truck)}</span>,
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

export function AgencyDetailPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<AgencyDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLoad, setSelectedLoad] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setData(null);
    setError(null);
    getAgency(code)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const backLink = (
    <Link
      to="/agencies"
      className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium text-ink-muted hover:bg-surface-muted dark:border-dark-border dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
    >
      ← All agencies
    </Link>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Agency" actions={backLink} />
        <p className="rounded-md bg-negative-muted p-3 font-body text-sm text-negative">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Agency" actions={backLink} />
        <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading…</p>
      </div>
    );
  }

  const { agency, contacts, loads, overall, possible_matches } = data;
  const enoughLoads = agency.load_count >= LOW_SAMPLE;
  const rpmTone =
    !enoughLoads || agency.weighted_rpm === null || overall.weighted_rpm === null
      ? "neutral"
      : agency.weighted_rpm >= overall.weighted_rpm
        ? "positive"
        : "negative";
  // Higher deadhead is worse, so the colors are the reverse of RPM's.
  const deadheadTone =
    !enoughLoads || agency.deadhead_pct === null || overall.deadhead_pct === null
      ? "neutral"
      : agency.deadhead_pct <= overall.deadhead_pct
        ? "positive"
        : "negative";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={agency.name}
        subtitle={
          agency.codes.length > 1
            ? `Combined codes: ${agency.codes.map((c) => c.code).join(", ")} (same contact info)`
            : `Agency code ${agency.id}`
        }
        actions={backLink}
      />

      {possible_matches.length > 0 && (
        <p className="rounded-md bg-warning-muted p-3 font-body text-sm text-ink">
          Shares contact info with{" "}
          {possible_matches.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ", "}
              <Link to={`/agencies/${encodeURIComponent(m.id)}`} className="font-semibold underline">
                {m.name}
              </Link>
            </span>
          ))}
          , but the names differ, so they're kept separate. Worth checking for a data mix-up.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricTile label="Loads" value={String(agency.load_count)} />
        <MetricTile label="Revenue" value={formatCurrency(agency.total_revenue)} />
        <MetricTile
          label="RPM"
          value={formatRPM(agency.weighted_rpm)}
          tone={rpmTone}
          hint={`Overall ${formatRPM(overall.weighted_rpm)}`}
        />
        <MetricTile
          label="Deadhead"
          value={formatPercent(agency.deadhead_pct)}
          tone={deadheadTone}
          hint={`Overall ${formatPercent(overall.deadhead_pct)}`}
        />
        <MetricTile label="Avg / Load" value={formatCurrency(agency.avg_revenue_per_load)} />
        <MetricTile label="Last Load" value={formatDate(agency.last_load_date)} />
      </div>
      {!enoughLoads && agency.load_count > 0 && (
        <p className="-mt-3 font-body text-xs text-ink-faint dark:text-dark-ink-muted">
          Only {agency.load_count} load{agency.load_count === 1 ? "" : "s"} so far — averages are rough, so the
          comparison colors are turned off.
        </p>
      )}

      <Card>
        <h3 className="mb-3 text-sm text-ink dark:text-dark-ink">Contacts</h3>
        {contacts.length === 0 ? (
          <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
            No contact info on file.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((c, i) => (
              <div
                key={i}
                className="rounded-md border border-border p-3 font-mono text-sm dark:border-dark-border"
              >
                <p>
                  {c.phone_number ? (
                    <a href={`tel:${c.phone_number}`} className="text-accent hover:underline">
                      {formatPhone(c.phone_number)}
                    </a>
                  ) : (
                    <span className="text-ink-faint dark:text-dark-ink-muted">No phone</span>
                  )}
                </p>
                <p className="mt-1 break-all">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="text-accent hover:underline">
                      {c.email}
                    </a>
                  ) : (
                    <span className="text-ink-faint dark:text-dark-ink-muted">No email</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm text-ink dark:text-dark-ink">Loads</h3>
        <DataTable
          columns={loadColumns}
          rows={loads}
          rowKey={(r) => r.load_number}
          onRowClick={(r) => setSelectedLoad(r.load_number)}
          emptyMessage="No loads from this agency yet."
        />
      </div>

      {selectedLoad && <LoadDetailModal loadNumber={selectedLoad} onClose={() => setSelectedLoad(null)} />}
    </div>
  );
}
