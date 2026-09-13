import { useEffect, useState } from "react";
import { getLoadByNumber } from "@/lib/api";
import { formatCurrency, formatDate, formatLocation, formatMiles, formatPercent, formatRPM } from "@/lib/format";
import type { LoadDetail } from "@/lib/types";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">{label}</p>
      <p className="break-words font-mono text-sm text-ink dark:text-dark-ink">{value}</p>
    </div>
  );
}

export function LoadDetailModal({
  loadNumber,
  onClose,
}: {
  loadNumber: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<LoadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    getLoadByNumber(loadNumber)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [loadNumber]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-6 dark:bg-dark-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-xl text-ink dark:text-dark-ink">Load {loadNumber}</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-ink-muted hover:bg-surface-muted dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
          >
            Close
          </button>
        </div>

        {error && <p className="font-body text-sm text-negative">{error}</p>}

        {!detail && !error && (
          <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading…</p>
        )}

        {detail && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Agency" value={detail.agency_name} />
              <Field label="Freight Bill" value={detail.freight_bill} />
              <Field label="Phone" value={detail.phone_number} />
              <Field label="Email" value={detail.email} />
              <Field label="Pickup Date" value={formatDate(detail.pickup_date)} />
              <Field label="Delivery Date" value={formatDate(detail.delivery_date)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Previous Delivery (Deadhead From)"
                value={
                  detail.previous_delivery_location
                    ? formatLocation(detail.previous_delivery_location)
                    : "— (earliest load on record)"
                }
              />
              <Field label="Pickup Location" value={formatLocation(detail.pickup_location)} />
              <Field label="Delivery Location" value={formatLocation(detail.delivery_location)} />
              {detail.stop_2_address && (
                <Field label="Stop 2" value={formatLocation(detail.stop_2_address)} />
              )}
              {detail.stop_3_address && (
                <Field label="Stop 3" value={formatLocation(detail.stop_3_address)} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Loaded Miles" value={formatMiles(detail.loaded_miles)} />
              <Field label="Deadhead" value={formatMiles(detail.deadhead)} />
              <Field label="Total Miles" value={formatMiles(detail.total_miles)} />
              <Field label="Deadhead %" value={formatPercent(detail.deadhead_percentage)} />
            </div>

            <div className="rounded-lg border border-border bg-surface-muted p-4 dark:border-dark-border dark:bg-dark-surface-muted">
              <h4 className="mb-3 text-sm text-ink dark:text-dark-ink">Financial Breakdown</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Line Haul" value={formatCurrency(detail.line_haul)} />
                <Field label="Fuel Surcharge" value={formatCurrency(detail.fuel_surcharge)} />
                <Field label="Accessorials" value={formatCurrency(detail.accessorials)} />
                <Field label="Fuel Cost" value={formatCurrency(detail.fuel_cost)} />
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 dark:border-dark-border">
                <span className="font-body text-sm font-medium text-ink dark:text-dark-ink">
                  Gross to the Truck
                </span>
                <span className="font-mono text-lg font-semibold text-positive">
                  {formatCurrency(detail.gross_to_the_truck)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">RPM</span>
                <span className="font-mono text-sm text-ink dark:text-dark-ink">{formatRPM(detail.RPM)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
