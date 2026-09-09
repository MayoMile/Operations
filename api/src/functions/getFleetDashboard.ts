import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

export async function getFleetDashboard(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const [truckIdleTime, fuelSurchargeRatioByWeek, haulLengthComparison, agencyPerformance] =
      await Promise.all([
        pool.request().query("SELECT * FROM dbo.vw_TruckIdleTime ORDER BY this_delivery"),
        pool
          .request()
          .query("SELECT * FROM dbo.vw_FuelSurchargeRatioByWeek ORDER BY week_year, week_number"),
        pool.request().query("SELECT * FROM dbo.vw_HaulLengthComparison"),
        pool
          .request()
          .query("SELECT * FROM dbo.vw_AgencyPerformance ORDER BY total_revenue DESC"),
      ]);

    return {
      jsonBody: {
        truckIdleTime: truckIdleTime.recordset,
        fuelSurchargeRatioByWeek: fuelSurchargeRatioByWeek.recordset,
        haulLengthComparison: haulLengthComparison.recordset,
        agencyPerformance: agencyPerformance.recordset,
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load fleet efficiency dashboard data." } };
  }
}

app.http("getFleetDashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboards/fleet",
  handler: getFleetDashboard,
});
