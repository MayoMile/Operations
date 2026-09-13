// Shapes returned by the /api endpoints. Mirrors dbo.Loads and related
// views/functions — see the database schema notes in the project README.

export interface LoadSummary {
  load_number: string;
  agency_name: string;
  pickup_date: string;
  pickup_location: string;
  delivery_date: string;
  delivery_location: string;
  loaded_miles: number;
  deadhead: number | null;
  total_miles: number | null;
  gross_to_the_truck: number;
  RPM: number | null;
}

export interface LoadDetail extends LoadSummary {
  id: number;
  agency_code: string;
  phone_number: string;
  email: string;
  stop_2_address: string | null;
  stop_3_address: string | null;
  freight_bill: string;
  line_haul: number;
  fuel_surcharge: number;
  accessorials: number;
  deadhead_percentage: number | null;
  fuel_cost: number | null;
  created_at: string;
  updated_at: string;
  /** Delivery location of the previous load in the truck's schedule — where
   * this load's deadhead was measured from. Null for the earliest load on
   * record. */
  previous_delivery_location: string | null;
}

export interface LoadsSummary {
  totalLoads: number;
  totalMiles: number;
  totalRevenue: number;
  weightedRPM: number | null;
  avgDeadheadMiles: number | null;
}

export interface PaginatedLoads {
  rows: LoadSummary[];
  total: number;
  page: number;
  pageSize: number;
  /**
   * Aggregate metrics for the full matching set (not just the current page).
   * Present on /api/loads (all-time totals) — search/week/agency results
   * return the complete matching set already, so the frontend computes this
   * itself via `computeSummary` instead.
   */
  summary?: LoadsSummary;
}

export interface WeeklyTotalsRow {
  week_number: number;
  week_year: number;
  load_count: number;
  total_loaded_miles: number;
  total_deadhead_miles: number;
  total_miles: number;
  avg_deadhead_pct: number | null;
  total_line_haul: number;
  total_fuel_surcharge: number;
  total_accessorials: number;
  gross_revenue: number;
  total_fuel_cost: number;
  total_revenue: number;
  avg_rpm: number | null;
}

export interface WeeklyProfitabilityRow {
  week_number: number;
  week_year: number;
  load_count: number;
  weekly_miles: number;
  weekly_revenue: number;
  weekly_fuel_cost: number;
  base_pay: number;
  mile_threshold: number;
  overage_rate_per_mile: number;
  truck_payment: number;
  driver_pay: number;
  net_profit_before_other_expenses: number;
}

export interface MonthlyRevenueRow {
  year: number;
  month: number;
  load_count: number;
  total_miles: number;
  total_line_haul: number;
  total_fuel_surcharge: number;
  total_accessorials: number;
  gross_revenue: number;
  total_fuel_cost: number;
  net_revenue: number;
  avg_rpm: number | null;
  weighted_rpm: number | null;
}

export interface WeeklyRpmSummaryRow {
  week_number: number;
  week_year: number;
  load_count: number;
  avg_rpm: number | null;
}

export interface TruckIdleTimeRow {
  load_number: string;
  this_delivery: string;
  next_pickup: string | null;
  idle_hours_until_next_load: number | null;
}

export interface FuelSurchargeRatioByWeekRow {
  week_number: number;
  week_year: number;
  total_fuel_surcharge: number;
  total_miles_driven: number;
  fuel_surcharge_per_mile: number | null;
}

export interface HaulLengthComparisonRow {
  haul_length_category: string;
  load_count: number;
  avg_rpm: number | null;
  avg_deadhead_pct: number | null;
  avg_revenue_per_load: number | null;
}

export interface AgencyPerformanceRow {
  agency_name: string;
  load_count: number;
  total_revenue: number;
  avg_revenue_per_load: number | null;
  avg_rpm: number | null;
  weighted_rpm: number | null;
}

export interface IncompleteFinancialDataRow {
  load_number: string;
  line_haul: number | null;
  fuel_surcharge: number | null;
  gross_to_the_truck: number | null;
  deadhead: number | null;
}

export interface GrossToTheTruckVarianceCheckRow {
  load_number: string;
  line_haul: number;
  fuel_surcharge: number;
  accessorials: number;
  gross_to_the_truck: number;
  calculated_subtotal: number;
  variance: number;
}

export interface CurrencyMigrationSpotCheckRow {
  load_number: string;
  line_haul: number;
  gross_to_the_truck: number;
  fuel_surcharge: number;
  deadhead: number | null;
}

export interface ExecutiveDashboardData {
  weeklyTotals: WeeklyTotalsRow[];
  monthlyRevenue: MonthlyRevenueRow[];
  weeklyProfitability: WeeklyProfitabilityRow[];
  weeklyRpmSummary: WeeklyRpmSummaryRow[];
}

export interface FleetDashboardData {
  truckIdleTime: TruckIdleTimeRow[];
  fuelSurchargeRatioByWeek: FuelSurchargeRatioByWeekRow[];
  haulLengthComparison: HaulLengthComparisonRow[];
  agencyPerformance: AgencyPerformanceRow[];
}

export interface DataQualityDashboardData {
  incompleteFinancialData: IncompleteFinancialDataRow[];
  grossToTheTruckVarianceCheck: GrossToTheTruckVarianceCheckRow[];
  currencyMigrationSpotCheck: CurrencyMigrationSpotCheckRow[];
}

export type MostRecentLoad = LoadDetail;

export interface DieselPriceResponse {
  value: number;
  period: string;
  live: boolean;
}

export interface SettlementDateSummary {
  statement_date: string;
  net_total: number;
}

export interface SettlementLine {
  id: number;
  entry_date: string | null;
  description: string | null;
  category: string | null;
  line_type: "revenue" | "reversal" | "deduction" | string;
  amount: number;
  signed_amount: number;
}

export interface SettlementGroup {
  agency_code: string | null;
  freight_bill: string | null;
  load_number: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_date: string | null;
  net_amount: number;
  lines: SettlementLine[];
}

export interface SettlementStatement {
  statement_date: string;
  groups: SettlementGroup[];
  summary: {
    total_revenue: number;
    total_reversals: number;
    total_deductions: number;
    by_category: Record<string, number>;
    net_total: number;
  };
}
