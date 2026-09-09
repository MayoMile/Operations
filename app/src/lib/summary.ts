import type { LoadSummary, LoadsSummary } from "./types";

export function computeSummary(rows: LoadSummary[]): LoadsSummary {
  const totalLoads = rows.length;
  let totalMiles = 0;
  let totalRevenue = 0;
  let deadheadSum = 0;
  let deadheadCount = 0;

  for (const row of rows) {
    if (row.total_miles !== null) totalMiles += row.total_miles;
    totalRevenue += row.gross_to_the_truck;
    if (row.deadhead !== null) {
      deadheadSum += row.deadhead;
      deadheadCount += 1;
    }
  }

  return {
    totalLoads,
    totalMiles,
    totalRevenue,
    weightedRPM: totalMiles > 0 ? totalRevenue / totalMiles : null,
    avgDeadheadMiles: deadheadCount > 0 ? deadheadSum / deadheadCount : null,
  };
}
