import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../db/pool.js";

const LIST_COLUMNS = `
  load_number, agency_name, pickup_date, pickup_location, delivery_date,
  delivery_location, loaded_miles, deadhead, total_miles, gross_to_the_truck, RPM
`;

export async function getLoadsForWeek(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const week = Number(request.params.week);
    const year = Number(request.params.year);
    if (!week || !year) {
      return { status: 400, jsonBody: { error: "week and year must be numbers." } };
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("week_number", sql.Int, week)
      .input("week_year", sql.Int, year)
      .query(`
        SELECT ${LIST_COLUMNS}
        FROM dbo.fn_LoadsForWeek(@week_number, @week_year)
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
    return { status: 500, jsonBody: { error: "Failed to load loads for week." } };
  }
}

app.http("getLoadsForWeek", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "loads/week/{week}/{year}",
  handler: getLoadsForWeek,
});
