import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPool, sql } from "../db/pool.js";

interface SettlementLineRow {
  id: number;
  entry_date: string | null;
  agency_code: string | null;
  freight_bill: string | null;
  description: string | null;
  category: string | null;
  line_type: string | null;
  amount: number;
  load_number: string | null;
  pickup_location: string | null;
  delivery_location: string | null;
  pickup_date: string | null;
}

function signedAmount(lineType: string | null, amount: number): number {
  return lineType === "revenue" ? amount : -amount;
}

export async function getSettlementStatement(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const statementDate = request.params.date;
    if (!statementDate) {
      return { status: 400, jsonBody: { error: "statement date is required." } };
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("statement_date", sql.Date, statementDate)
      .query<SettlementLineRow>(`
        SELECT
          s.id, s.entry_date, s.agency_code, s.freight_bill, s.description,
          s.category, s.line_type, s.amount,
          l.load_number, l.pickup_location, l.delivery_location, l.pickup_date
        FROM dbo.SettlementLineItems s
        LEFT JOIN dbo.Loads l ON l.freight_bill = s.freight_bill
        WHERE s.statement_date = @statement_date
        ORDER BY s.agency_code, s.freight_bill, s.entry_date, s.id
      `);

    if (result.recordset.length === 0) {
      return { status: 404, jsonBody: { error: `No settlement statement found for ${statementDate}.` } };
    }

    // Group by (agency_code, freight_bill) exactly as tagged in the source
    // statement — deduction lines (card fees, truck stop scans, pre-trip
    // advances) are period-level driver costs, not caused by whichever load
    // they happen to be tagged against, but grouping this way preserves the
    // statement's own structure rather than second-guessing it.
    const groups = new Map<string, ReturnType<typeof buildGroup>>();
    for (const row of result.recordset) {
      const key = `${row.agency_code ?? ""}::${row.freight_bill ?? ""}`;
      if (!groups.has(key)) {
        groups.set(
          key,
          buildGroup(row.agency_code, row.freight_bill, row.load_number, row.pickup_location, row.delivery_location, row.pickup_date),
        );
      }
      const group = groups.get(key)!;
      const amount = signedAmount(row.line_type, row.amount);
      group.lines.push({
        id: row.id,
        entry_date: row.entry_date,
        description: row.description,
        category: row.category,
        line_type: row.line_type,
        amount: row.amount,
        signed_amount: amount,
      });
      group.net_amount += amount;
    }

    const summaryByCategory: Record<string, number> = {};
    let totalRevenue = 0;
    let totalReversals = 0;
    let totalDeductions = 0;
    for (const row of result.recordset) {
      const amount = signedAmount(row.line_type, row.amount);
      const category = row.category ?? "other";
      summaryByCategory[category] = (summaryByCategory[category] ?? 0) + amount;
      if (row.line_type === "revenue") totalRevenue += row.amount;
      else if (row.line_type === "reversal") totalReversals += row.amount;
      else if (row.line_type === "deduction") totalDeductions += row.amount;
    }

    return {
      jsonBody: {
        statement_date: statementDate,
        groups: Array.from(groups.values()),
        summary: {
          total_revenue: totalRevenue,
          total_reversals: totalReversals,
          total_deductions: totalDeductions,
          by_category: summaryByCategory,
          net_total: totalRevenue - totalReversals - totalDeductions,
        },
      },
    };
  } catch (err) {
    context.error(err);
    return { status: 500, jsonBody: { error: "Failed to load settlement statement." } };
  }
}

function buildGroup(
  agencyCode: string | null,
  freightBill: string | null,
  loadNumber: string | null,
  pickupLocation: string | null,
  deliveryLocation: string | null,
  pickupDate: string | null,
) {
  return {
    agency_code: agencyCode,
    freight_bill: freightBill,
    load_number: loadNumber,
    pickup_location: pickupLocation,
    delivery_location: deliveryLocation,
    pickup_date: pickupDate,
    net_amount: 0,
    lines: [] as {
      id: number;
      entry_date: string | null;
      description: string | null;
      category: string | null;
      line_type: string | null;
      amount: number;
      signed_amount: number;
    }[],
  };
}

app.http("getSettlementStatement", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "settlements/{date}",
  handler: getSettlementStatement,
});
