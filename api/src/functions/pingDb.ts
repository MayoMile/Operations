import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

// Pinged on a timer by a scheduled GitHub Actions job to keep
// mayomilesql1 (Azure SQL Serverless) from auto-pausing during business
// hours — resuming from pause takes 20-50+ seconds, which was showing up
// as the dashboard stalling on Loads/Reports. A trivial query is enough to
// keep the connection, and therefore the database, active. Anonymous and
// unauthenticated on purpose: this exists to be pinged by a timer, not for
// any user-facing data, and staticwebapp.config.json exempts its route
// from the "authorized" gate that covers every real data endpoint.
export async function pingDb(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1");
    return { jsonBody: { ok: true } };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { ok: false } };
  }
}

app.http("pingDb", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "ping",
  handler: pingDb,
});
