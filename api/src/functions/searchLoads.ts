import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../db/pool.js";

const LIST_COLUMNS = `
  load_number, agency_name, pickup_date, pickup_location, delivery_date,
  delivery_location, loaded_miles, deadhead, total_miles, gross_to_the_truck, RPM
`;

export async function searchLoads(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const q = request.query.get("q");
    if (!q) {
      return { status: 400, jsonBody: { error: "Query parameter q is required." } };
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("search_text", sql.VarChar, q)
      .query(`
        SELECT ${LIST_COLUMNS}
        FROM dbo.fn_LoadsByNumberSearch(@search_text)
        ORDER BY pickup_date DESC
      `);

    return {
      jsonBody: {
        rows: result.recordset,
        total: result.recordset.length,
        page: 1,
        pageSize: result.recordset.length,
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to search loads." } };
  }
}

app.http("searchLoads", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "loads/search",
  handler: searchLoads,
});
