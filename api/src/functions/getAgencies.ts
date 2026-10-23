import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";
import { loadAgencyGroups } from "../lib/agencyGroups.js";

export async function getAgencies(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const { groups, overall } = await loadAgencyGroups(pool);
    return { jsonBody: { agencies: groups.map((g) => g.summary), overall } };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load agencies." } };
  }
}

app.http("getAgencies", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "agencies",
  handler: getAgencies,
});
