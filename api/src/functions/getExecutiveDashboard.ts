import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

export async function getExecutiveDashboard(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const [weeklyTotals, monthlyRevenue, weeklyProfitability, weeklyRpmSummary, loadRpm] =
      await Promise.all([
        pool
          .request()
          .query("SELECT * FROM dbo.vw_WeeklyTotals ORDER BY week_year, week_number"),
        pool.request().query("SELECT * FROM dbo.vw_MonthlyRevenue ORDER BY year, month"),
        pool
          .request()
          .query("SELECT * FROM dbo.vw_WeeklyProfitability ORDER BY week_year, week_number"),
        pool
          .request()
          .query("SELECT * FROM dbo.vw_WeeklyRpmSummary ORDER BY week_year, week_number"),
        // Per-load pickup_date + RPM, for the "loads over RPM threshold"
        // chart — kept as raw rows (not pre-bucketed) so the frontend can
        // apply the same date-range filter it already applies to every
        // other chart on this dashboard, instead of introducing a second,
        // server-side filtering path.
        pool
          .request()
          .query("SELECT pickup_date, RPM FROM dbo.Loads WHERE RPM IS NOT NULL"),
      ]);

    return {
      jsonBody: {
        weeklyTotals: weeklyTotals.recordset,
        monthlyRevenue: monthlyRevenue.recordset,
        weeklyProfitability: weeklyProfitability.recordset,
        weeklyRpmSummary: weeklyRpmSummary.recordset,
        loadRpm: loadRpm.recordset,
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load executive dashboard data." } };
  }
}

app.http("getExecutiveDashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboards/executive",
  handler: getExecutiveDashboard,
});
