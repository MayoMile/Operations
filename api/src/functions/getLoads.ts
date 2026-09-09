import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../db/pool.js";

const LIST_COLUMNS = `
  load_number, agency_name, pickup_date, pickup_location, delivery_date,
  delivery_location, loaded_miles, deadhead, total_miles, gross_to_the_truck, RPM
`;

export async function getLoads(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const page = Math.max(1, Number(request.query.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(request.query.get("pageSize")) || 25));
    const offset = (page - 1) * pageSize;

    const pool = await getPool();

    const totalResult = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.Loads");
    const total: number = totalResult.recordset[0].total;

    const summaryResult = await pool.request().query(`
      SELECT
        COUNT(*) AS totalLoads,
        SUM(total_miles) AS totalMiles,
        SUM(gross_to_the_truck) AS totalRevenue,
        CASE WHEN SUM(total_miles) > 0 THEN SUM(gross_to_the_truck) / SUM(total_miles) ELSE NULL END AS weightedRPM,
        AVG(CAST(deadhead AS FLOAT)) AS avgDeadheadMiles
      FROM dbo.Loads
    `);
    const s = summaryResult.recordset[0];

    const rowsResult = await pool
      .request()
      .input("offset", sql.Int, offset)
      .input("pageSize", sql.Int, pageSize)
      .query(`
        SELECT ${LIST_COLUMNS}
        FROM dbo.Loads
        ORDER BY pickup_date DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `);

    return {
      jsonBody: {
        rows: rowsResult.recordset,
        total,
        page,
        pageSize,
        summary: {
          totalLoads: s.totalLoads ?? 0,
          totalMiles: s.totalMiles ?? 0,
          totalRevenue: s.totalRevenue ?? 0,
          weightedRPM: s.weightedRPM,
          avgDeadheadMiles: s.avgDeadheadMiles,
        },
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load loads." } };
  }
}

app.http("getLoads", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "loads",
  handler: getLoads,
});
