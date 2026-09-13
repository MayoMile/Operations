import type {
  DataQualityDashboardData,
  DieselPriceResponse,
  ExecutiveDashboardData,
  FleetDashboardData,
  LoadDetail,
  MostRecentLoad,
  PaginatedLoads,
  SettlementDateSummary,
  SettlementStatement,
  WeeklyProfitabilityRow,
  WeeklyTotalsRow,
} from "./types";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export function getLoads(page = 1, pageSize = 25): Promise<PaginatedLoads> {
  return getJSON(`/api/loads?page=${page}&pageSize=${pageSize}`);
}

export function getLoadByNumber(loadNumber: string): Promise<LoadDetail> {
  return getJSON(`/api/loads/${encodeURIComponent(loadNumber)}`);
}

export function searchLoads(query: string): Promise<PaginatedLoads> {
  return getJSON(`/api/loads/search?q=${encodeURIComponent(query)}`);
}

export function getLoadsForWeek(
  week: number,
  year: number,
): Promise<PaginatedLoads> {
  return getJSON(`/api/loads/week/${week}/${year}`);
}

export function getWeeklyTotals(): Promise<WeeklyTotalsRow[]> {
  return getJSON(`/api/weekly-totals`);
}

export function getWeeklyProfitability(
  week: number,
  year: number,
): Promise<WeeklyProfitabilityRow | null> {
  return getJSON(
    `/api/weekly-profitability?week=${week}&year=${year}`,
  );
}

export function getMostRecentLoad(): Promise<MostRecentLoad> {
  return getJSON(`/api/dashboards/most-recent-load`);
}

export function getExecutiveDashboard(): Promise<ExecutiveDashboardData> {
  return getJSON(`/api/dashboards/executive`);
}

export function getFleetDashboard(): Promise<FleetDashboardData> {
  return getJSON(`/api/dashboards/fleet`);
}

export function getDataQualityDashboard(): Promise<DataQualityDashboardData> {
  return getJSON(`/api/dashboards/data-quality`);
}

export function getDieselPrice(): Promise<DieselPriceResponse> {
  return getJSON(`/api/route-calculator/diesel-price`);
}

export function getSettlementDates(): Promise<{ statements: SettlementDateSummary[] }> {
  return getJSON(`/api/settlements/dates`);
}

export function getSettlementStatement(date: string): Promise<SettlementStatement> {
  return getJSON(`/api/settlements/${encodeURIComponent(date)}`);
}
