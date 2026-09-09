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

    return { jsonBody: result.recordset[0] };
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
