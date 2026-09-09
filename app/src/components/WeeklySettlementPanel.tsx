import { Card } from "./Card";
import { MetricTile } from "./MetricTile";
import { formatCurrency } from "@/lib/format";
import type { WeeklyProfitabilityRow } from "@/lib/types";

export function WeeklySettlementPanel({ data }: { data: WeeklyProfitabilityRow }) {
  const netProfit = data.net_profit_before_other_expenses;
  return (
    <Card>
      <h3 className="mb-3 text-sm text-ink dark:text-dark-ink">This Week's Settlement</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Driver Pay" value={formatCurrency(data.driver_pay)} />
        <MetricTile label="Truck Payment" value={formatCurrency(data.truck_payment)} />
        <MetricTile label="Fuel Cost" value={formatCurrency(data.weekly_fuel_cost)} />
        <MetricTile
          label="Net Profit"
          value={formatCurrency(netProfit)}
          tone={netProfit >= 0 ? "positive" : "negative"}
        />
      </div>
    </Card>
  );
}
