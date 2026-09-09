import { useEffect, useState } from "react";
import { ChartCard } from "@/components/ChartCard";
import { MetricTile } from "@/components/MetricTile";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { getDataQualityDashboard } from "@/lib/api";
import { formatCurrency, formatMiles } from "@/lib/format";
import type {
  CurrencyMigrationSpotCheckRow,
  DataQualityDashboardData,
  GrossToTheTruckVarianceCheckRow,
} from "@/lib/types";

export function DataQualityDashboard() {
  const [data, setData] = useState<DataQualityDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDataQualityDashboard()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <p className="rounded-md bg-negative-muted p-3 font-body text-sm text-negative">{error}</p>
    );
  }

  if (!data) {
    return <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">Loading…</p>;
  }

  const varianceColumns: Column<GrossToTheTruckVarianceCheckRow>[] = [
    { key: "load_number", header: "Load #", render: (r) => r.load_number },
    {
      key: "line_haul",
      header: "Line Haul",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.line_haul)}</span>,
    },
    {
      key: "fuel_surcharge",
      header: "Fuel Surcharge",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.fuel_surcharge)}</span>,
    },
    {
      key: "accessorials",
      header: "Accessorials",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.accessorials)}</span>,
    },
    {
      key: "calculated_subtotal",
      header: "Calculated",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.calculated_subtotal)}</span>,
    },
    {
      key: "gross_to_the_truck",
      header: "Gross to Truck",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.gross_to_the_truck)}</span>,
    },
    {
      key: "variance",
      header: "Variance",
      align: "right",
      render: (r) => (
        <StatusBadge tone={Math.abs(r.variance) > 0.01 ? "negative" : "positive"}>
          {formatCurrency(r.variance)}
        </StatusBadge>
      ),
    },
  ];

  const currencyColumns: Column<CurrencyMigrationSpotCheckRow>[] = [
    { key: "load_number", header: "Load #", render: (r) => r.load_number },
    {
      key: "line_haul",
      header: "Line Haul",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.line_haul)}</span>,
    },
    {
      key: "fuel_surcharge",
      header: "Fuel Surcharge",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.fuel_surcharge)}</span>,
    },
    {
      key: "gross_to_the_truck",
      header: "Gross to Truck",
      align: "right",
      render: (r) => <span className="font-mono">{formatCurrency(r.gross_to_the_truck)}</span>,
    },
    {
      key: "deadhead",
      header: "Deadhead",
      align: "right",
      render: (r) => <span className="font-mono">{formatMiles(r.deadhead)}</span>,
    },
  ];

  const varianceCount = data.grossToTheTruckVarianceCheck.filter(
    (r) => Math.abs(r.variance) > 0.01,
  ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile
          label="Incomplete Financial Records"
          value={String(data.incompleteFinancialData.length)}
          tone={data.incompleteFinancialData.length > 0 ? "warning" : "positive"}
          hint="Missing line haul, fuel surcharge, or gross pay"
        />
        <MetricTile
          label="Gross Pay Variances"
          value={String(varianceCount)}
          tone={varianceCount > 0 ? "negative" : "positive"}
          hint="Reconciliation mismatches over $0.01"
        />
        <MetricTile
          label="Currency Spot-Check Records"
          value={String(data.currencyMigrationSpotCheck.length)}
          hint="Flagged for migrated-data review"
        />
      </div>

      {data.incompleteFinancialData.length > 0 && (
        <ChartCard title="Incomplete Financial Data" subtitle="Loads missing required financial fields">
          <DataTable
            columns={[
              { key: "load_number", header: "Load #", render: (r) => r.load_number },
              {
                key: "line_haul",
                header: "Line Haul",
                align: "right",
                render: (r) => <span className="font-mono">{formatCurrency(r.line_haul)}</span>,
              },
              {
                key: "fuel_surcharge",
                header: "Fuel Surcharge",
                align: "right",
                render: (r) => <span className="font-mono">{formatCurrency(r.fuel_surcharge)}</span>,
              },
              {
                key: "gross_to_the_truck",
                header: "Gross to Truck",
                align: "right",
                render: (r) => (
                  <span className="font-mono">{formatCurrency(r.gross_to_the_truck)}</span>
                ),
              },
              {
                key: "deadhead",
                header: "Deadhead",
                align: "right",
                render: (r) => <span className="font-mono">{formatMiles(r.deadhead)}</span>,
              },
            ]}
            rows={data.incompleteFinancialData}
            rowKey={(r) => r.load_number}
          />
        </ChartCard>
      )}

      <ChartCard
        title="Gross-to-the-Truck Variance Check"
        subtitle="Line haul + fuel surcharge + accessorials vs. recorded gross pay"
      >
        <DataTable columns={varianceColumns} rows={data.grossToTheTruckVarianceCheck} rowKey={(r) => r.load_number} />
      </ChartCard>

      <ChartCard title="Currency Migration Spot Check" subtitle="Auditing migrated currency and mileage records">
        <DataTable columns={currencyColumns} rows={data.currencyMigrationSpotCheck} rowKey={(r) => r.load_number} />
      </ChartCard>
    </div>
  );
}
