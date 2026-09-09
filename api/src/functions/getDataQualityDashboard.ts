import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool } from "../db/pool.js";

export async function getDataQualityDashboard(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const pool = await getPool();
    const [incompleteFinancialData, grossToTheTruckVarianceCheck, currencyMigrationSpotCheck] =
      await Promise.all([
        pool.request().query("SELECT * FROM dbo.vw_IncompleteFinancialData ORDER BY load_number"),
        pool
          .request()
          .query("SELECT * FROM dbo.vw_GrossToTheTruckVarianceCheck ORDER BY ABS(variance) DESC"),
        pool.request().query("SELECT * FROM dbo.vw_CurrencyMigrationSpotCheck ORDER BY load_number"),
      ]);

    return {
      jsonBody: {
        incompleteFinancialData: incompleteFinancialData.recordset,
        grossToTheTruckVarianceCheck: grossToTheTruckVarianceCheck.recordset,
        currencyMigrationSpotCheck: currencyMigrationSpotCheck.recordset,
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load data quality dashboard data." } };
  }
}

app.http("getDataQualityDashboard", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "dashboards/data-quality",
  handler: getDataQualityDashboard,
});
