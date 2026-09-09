import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../db/pool.js";

export async function getWeeklyProfitability(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const week = Number(request.query.get("week"));
    const year = Number(request.query.get("year"));
    if (!week || !year) {
      return { status: 400, jsonBody: { error: "week and year query params are required." } };
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("week_number", sql.Int, week)
      .input("week_year", sql.Int, year)
      .query(`
        SELECT * FROM dbo.vw_WeeklyProfitability
        WHERE week_number = @week_number AND week_year = @week_year
      `);

    if (result.recordset.length === 0) {
      return { status: 404, jsonBody: null };
    }

    return { jsonBody: result.recordset[0] };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load weekly profitability." } };
  }
}

app.http("getWeeklyProfitability", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "weekly-profitability",
  handler: getWeeklyProfitability,
});
