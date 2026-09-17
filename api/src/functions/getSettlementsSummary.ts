import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

// All-time totals across every settlement statement on file — same shape
// as a single statement's summary in getSettlementStatement.ts, just
// aggregated instead of scoped to one statement_date.
export async function getSettlementsSummary(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        SUM(CASE WHEN line_type = 'revenue' THEN amount ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN line_type = 'reversal' THEN amount ELSE 0 END) AS total_reversals,
        SUM(CASE WHEN line_type = 'deduction' THEN amount ELSE 0 END) AS total_deductions,
        COUNT(DISTINCT statement_date) AS statement_count
      FROM dbo.SettlementLineItems
    `);

    const row = result.recordset[0];
    const totalRevenue = row.total_revenue ?? 0;
    const totalReversals = row.total_reversals ?? 0;
    const totalDeductions = row.total_deductions ?? 0;

    return {
      jsonBody: {
        statement_count: row.statement_count,
        summary: {
          total_revenue: totalRevenue,
          total_reversals: totalReversals,
          total_deductions: totalDeductions,
          net_total: totalRevenue - totalReversals - totalDeductions,
        },
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load settlements summary." } };
  }
}

app.http("getSettlementsSummary", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "settlements/summary",
  handler: getSettlementsSummary,
});
