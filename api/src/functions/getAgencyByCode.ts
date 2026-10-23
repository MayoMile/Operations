import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../db/pool.js";
import { loadAgencyGroups } from "../lib/agencyGroups.js";

const LIST_COLUMNS = `
  load_number, agency_name, pickup_date, pickup_location, delivery_date,
  delivery_location, loaded_miles, deadhead, total_miles, gross_to_the_truck, RPM
`;

export async function getAgencyByCode(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const code = request.params.code?.trim().toUpperCase();
    if (!code) {
      return { status: 400, jsonBody: { error: "agency code is required." } };
    }

    const pool = await getPool();
    const { byCode, overall } = await loadAgencyGroups(pool);
    const group = byCode.get(code);
    if (!group) {
      return { status: 404, jsonBody: { error: `Agency ${code} not found.` } };
    }

    const req = pool.request();
    const placeholders = group.summary.codes.map(({ code: memberCode }, i) => {
      req.input(`code${i}`, sql.VarChar, memberCode);
      return `@code${i}`;
    });
    const loads = await req.query(`
      SELECT ${LIST_COLUMNS}
      FROM dbo.Loads
      WHERE RTRIM(agency_code) IN (${placeholders.join(", ")})
      ORDER BY pickup_date DESC
    `);

    return {
      jsonBody: {
        agency: group.summary,
        contacts: group.contacts,
        possible_matches: group.possible_matches,
        loads: loads.recordset,
        overall,
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load agency." } };
  }
}

app.http("getAgencyByCode", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "agencies/{code}",
  handler: getAgencyByCode,
});
