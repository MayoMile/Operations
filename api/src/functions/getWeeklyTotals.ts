import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

export async function getWeeklyTotals(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT * FROM dbo.vw_WeeklyTotals ORDER BY week_year DESC, week_number DESC");

    return { jsonBody: result.recordset };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load weekly totals." } };
  }
}

app.http("getWeeklyTotals", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "weekly-totals",
  handler: getWeeklyTotals,
});
