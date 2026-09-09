import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

export async function getMostRecentLoad(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM dbo.vw_MostRecentLoad");

    if (result.recordset.length === 0) {
      return { status: 404, jsonBody: { error: "No loads found." } };
    }

    return { jsonBody: result.recordset[0] };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load most recent load." } };
  }
}

app.http("getMostRecentLoad", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboards/most-recent-load",
  handler: getMostRecentLoad,
});
