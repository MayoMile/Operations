import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

// Real fuel spend (CARD PRE-TRIP settlement charges) vs. the flat
// $0.67/mile estimate baked into Loads.fuel_cost. Backed by three views
// built on dbo.SettlementLineItems; weekly RPM comes from the existing
// vw_WeeklyRpmSummary so the frontend can plot real margin over time.
export async function getFuelCostDashboard(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const [byLoad, variance, weekly, weeklyRpm] = await Promise.all([
      pool.request().query("SELECT * FROM dbo.vw_ActualFuelCostByLoad"),
      pool.request().query("SELECT * FROM dbo.vw_FuelCostVarianceFromEstimate"),
      pool
        .request()
        .query("SELECT * FROM dbo.vw_WeeklyActualFuelCost ORDER BY week_year, week_number"),
      pool
        .request()
        .query("SELECT * FROM dbo.vw_WeeklyRpmSummary ORDER BY week_year, week_number"),
    ]);

    return {
      jsonBody: {
        byLoad: byLoad.recordset,
        variance: variance.recordset,
        weekly: weekly.recordset,
        weeklyRpm: weeklyRpm.recordset,
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load fuel cost dashboard data." } };
  }
}

app.http("getFuelCostDashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboards/fuel-cost",
  handler: getFuelCostDashboard,
});
