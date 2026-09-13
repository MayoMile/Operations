import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

// Lists available settlement statements for the picker, most recent first,
// each with a quick net total. Sign convention matches getSettlementStatement:
// revenue is positive, reversal/deduction are negative.
export async function getSettlementDates(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        statement_date,
        SUM(CASE WHEN line_type = 'revenue' THEN amount ELSE -amount END) AS net_total
      FROM dbo.SettlementLineItems
      GROUP BY statement_date
      ORDER BY statement_date DESC
    `);

    return { jsonBody: { statements: result.recordset } };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load settlement dates." } };
  }
}

app.http("getSettlementDates", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "settlements/dates",
  handler: getSettlementDates,
});
