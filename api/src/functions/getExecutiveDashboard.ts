import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

export async function getExecutiveDashboard(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const [weeklyTotals, monthlyRevenue, weeklyProfitability, weeklyRpmSummary] =
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
      ]);

    return {
      jsonBody: {
        weeklyTotals: weeklyTotals.recordset,
        monthlyRevenue: monthlyRevenue.recordset,
        weeklyProfitability: weeklyProfitability.recordset,
        weeklyRpmSummary: weeklyRpmSummary.recordset,
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
