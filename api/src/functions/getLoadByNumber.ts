import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../db/pool.js";

export async function getLoadByNumber(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const loadNumber = request.params.loadNumber;
    if (!loadNumber) {
      return { status: 400, jsonBody: { error: "loadNumber is required." } };
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("load_number", sql.VarChar, loadNumber)
      .query("SELECT * FROM dbo.vw_LoadsFullDetail WHERE load_number = @load_number");

    if (result.recordset.length === 0) {
      return { status: 404, jsonBody: { error: `Load ${loadNumber} not found.` } };
    }

    const load = result.recordset[0];

    // The load that immediately preceded this one in the truck's schedule —
    // its delivery location is where this load's deadhead was measured
    // from. There's only one truck, so the most recent prior pickup is
    // unambiguous; the earliest load in the whole history has none.
    const prevResult = await pool
      .request()
      .input("pickup_date", sql.DateTime, load.pickup_date)
      .query(`
        SELECT TOP 1 delivery_location
        FROM dbo.Loads
        WHERE pickup_date < @pickup_date
        ORDER BY pickup_date DESC
      `);

    return {
      jsonBody: {
        ...load,
        previous_delivery_location: prevResult.recordset[0]?.delivery_location ?? null,
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load load detail." } };
  }
}

app.http("getLoadByNumber", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "loads/{loadNumber}",
  handler: getLoadByNumber,
});
