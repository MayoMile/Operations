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
        // Per-load detail for the RPM threshold slider — kept as raw rows
        // (not pre-bucketed) so the frontend can apply the same date-range
        // filter it already applies to every other chart on this
        // dashboard, and so the matching loads can actually be listed, not
        // just counted.
        pool
          .request()
          .query(
            "SELECT load_number, agency_name, pickup_date, gross_to_the_truck, RPM FROM dbo.Loads WHERE RPM IS NOT NULL",
          ),
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
