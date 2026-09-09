import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// Fallback national average diesel price, used when EIA_API_KEY isn't
// configured or the live lookup fails. Sourced from EIA's own weekly retail
// diesel survey (series EMD_EPD2D_PTE_NUS_DPG). Update this pair
// periodically if the app is being run without a key.
const FALLBACK_DIESEL_PRICE = 5.348;
const FALLBACK_DIESEL_DATE = "2026-08-03";

async function fetchLiveDieselPrice(apiKey: string): Promise<{ value: number; period: string }> {
  const url =
    `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${encodeURIComponent(apiKey)}` +
    `&frequency=weekly&data[0]=value&facets[product][]=EPD2D&facets[duoarea][]=NUS` +
    `&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("EIA request failed");
  const json = (await res.json()) as { response?: { data?: { value?: number; period?: string }[] } };
  const row = json.response?.data?.[0];
  if (!row || row.value == null || !row.period) throw new Error("No EIA data returned");
  return { value: Number(row.value), period: row.period };
}

export async function getDieselPrice(
  _request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const apiKey = process.env.EIA_API_KEY;

  if (apiKey) {
    try {
      const live = await fetchLiveDieselPrice(apiKey);
      return { jsonBody: { value: live.value, period: live.period, live: true } };
    } catch (err) {
      context.warn("EIA live diesel price lookup failed, using fallback", err);
    }
  }

  return {
    jsonBody: { value: FALLBACK_DIESEL_PRICE, period: FALLBACK_DIESEL_DATE, live: false },
  };
}

app.http("getDieselPrice", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "route-calculator/diesel-price",
  handler: getDieselPrice,
});
