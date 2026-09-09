import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { MetricTile } from "@/components/MetricTile";
import { StatusBadge } from "@/components/StatusBadge";
import { getDieselPrice } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

// Ported from the standalone MayoMile Load Calculator (routes.mayomile.com).
// Formulas, rounding, and the geocoding/EIA/geolocation flow are preserved
// exactly — only the UI layer and the EIA key (now server-side) changed.

const ROAD_FACTOR = 1.17;
const SETTINGS_KEY = "mayomileCalcSettings_v1";

type FuelMode = "avg" | "manual";

interface PersistedSettings {
  mpg: string;
  targetRpm: string;
  fixedWeekly: string;
  variableCpm: string;
  transitHours: string;
  dwellHours: string;
}

function loadSettings(): Partial<PersistedSettings> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSettings(settings: PersistedSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — non-fatal
  }
}

// These preserve the calculator's original display precision, which is
// finer than the app's shared formatMiles/formatRPM (whole miles, 2-decimal
// RPM) elsewhere — deliberately not reusing those here per "don't change
// rounding behavior."
function fmtMi(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} mi`;
}
function fmt3(n: number): string {
  return `$${n.toFixed(3)}`;
}

interface CalcResults {
  deadheadMiles: number;
  loadedMiles: number;
  totalMiles: number;
  deadheadRatio: number;
  grossRpm: number;
  trueRpm: number;
  fuelCost: number;
  cpm: number;
  totalExpenses: number;
  netProfit: number;
  profitPerHour: number | null;
  profitPerDay: number | null;
  badge: { tone: "positive" | "warning" | "negative"; label: string } | null;
}

async function geocodeZip(zip: string): Promise<{ lat: number; lon: number }> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) throw new Error(`ZIP ${zip} not found`);
  const data = await res.json();
  const place = data.places[0];
  return { lat: parseFloat(place.latitude), lon: parseFloat(place.longitude) };
}

async function reverseGeocodeToZip(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
  );
  if (!res.ok) throw new Error("Reverse geocode lookup failed");
  const data = await res.json();
  const zip = String(data.postcode || "").trim();
  if (!/^\d{5}/.test(zip)) throw new Error("No ZIP found for this location");
  return zip.slice(0, 5);
}

function haversineMiles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2.5 font-mono text-base text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-muted dark:border-dark-border dark:bg-dark-surface-muted dark:text-dark-ink";
const labelClass =
  "mb-1.5 block font-body text-xs font-semibold uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted";

export function RouteCalculatorPage() {
  // Trip inputs
  const [currentZip, setCurrentZip] = useState("");
  const [pickupZip, setPickupZip] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualDeadhead, setManualDeadhead] = useState("");
  const [manualLoaded, setManualLoaded] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationHint, setLocationHint] = useState("");

  // Load & fuel inputs
  const [grossRate, setGrossRate] = useState("");
  const [fuelMode, setFuelMode] = useState<FuelMode>("avg");
  const [fuelPrice, setFuelPrice] = useState("");
  const [fuelPriceHint, setFuelPriceHint] = useState("loading…");
  const [mpg, setMpg] = useState("");
  const [targetRpm, setTargetRpm] = useState("");

  // Operating costs & time (persisted, except driverPay which is per-load)
  const [fixedWeekly, setFixedWeekly] = useState("");
  const [variableCpm, setVariableCpm] = useState("");
  const [driverPay, setDriverPay] = useState("");
  const [transitHours, setTransitHours] = useState("");
  const [dwellHours, setDwellHours] = useState("");

  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CalcResults | null>(null);

  useEffect(() => {
    const saved = loadSettings();
    if (saved.mpg !== undefined) setMpg(saved.mpg);
    if (saved.targetRpm !== undefined) setTargetRpm(saved.targetRpm);
    if (saved.fixedWeekly !== undefined) setFixedWeekly(saved.fixedWeekly);
    if (saved.variableCpm !== undefined) setVariableCpm(saved.variableCpm);
    if (saved.transitHours !== undefined) setTransitHours(saved.transitHours);
    if (saved.dwellHours !== undefined) setDwellHours(saved.dwellHours);
    // populate the National Avg fuel price on load, same as the original page
    applyNationalAverage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyNationalAverage() {
    setFuelPriceHint("checking live price…");
    try {
      const res = await getDieselPrice();
      setFuelPrice(res.value.toFixed(3));
      setFuelPriceHint(`as of ${res.period} · EIA weekly avg (${res.live ? "live" : "fallback"})`);
    } catch {
      setFuelPriceHint("Couldn't reach the fuel price service — enter one manually.");
    }
  }

  function handleFuelModeChange(mode: FuelMode) {
    setFuelMode(mode);
    if (mode === "manual") {
      setFuelPrice("");
      setFuelPriceHint("Enter your own price.");
    } else {
      applyNationalAverage();
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setLocationHint("Geolocation isn't supported on this device/browser. Enter your ZIP manually.");
      return;
    }
    setLocating(true);
    setLocationHint("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const zip = await reverseGeocodeToZip(pos.coords.latitude, pos.coords.longitude);
          setCurrentZip(zip);
          setLocationHint(`Set to ZIP ${zip} from your current location.`);
        } catch (err) {
          setLocationHint(
            `Couldn't determine a ZIP from your location (${(err as Error).message}). Enter it manually.`,
          );
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        let msg = "Couldn't get your location. Enter your ZIP manually.";
        if (err.code === err.PERMISSION_DENIED) msg = "Location permission denied. Enter your ZIP manually.";
        else if (err.code === err.TIMEOUT) msg = "Location request timed out. Enter your ZIP manually.";
        setLocationHint(msg);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function calculate() {
    setError(null);
    setResults(null);

    const grossRateNum = parseFloat(grossRate);
    const fuelPriceNum = parseFloat(fuelPrice);
    const mpgNum = parseFloat(mpg);
    const targetRpmNum = parseFloat(targetRpm) || 0;
    const fixedWeeklyNum = parseFloat(fixedWeekly) || 0;
    const variableCpmNum = parseFloat(variableCpm) || 0;
    const driverPayNum = parseFloat(driverPay) || 0;
    const transitHoursNum = parseFloat(transitHours) || 0;
    const dwellHoursNum = parseFloat(dwellHours) || 0;

    if (isNaN(grossRateNum) || grossRateNum < 0) return setError("Enter a valid line haul rate.");
    if (isNaN(fuelPriceNum) || fuelPriceNum <= 0) return setError("Enter a valid fuel price.");
    if (isNaN(mpgNum) || mpgNum <= 0) return setError("Enter a valid truck MPG.");

    let deadheadMiles: number;
    let loadedMiles: number;

    if (manualMode) {
      deadheadMiles = parseFloat(manualDeadhead) || 0;
      loadedMiles = parseFloat(manualLoaded);
      if (isNaN(loadedMiles) || loadedMiles <= 0) return setError("Enter loaded miles.");
    } else {
      const pickup = pickupZip.trim();
      const delivery = deliveryZip.trim();
      const current = currentZip.trim();
      if (!/^\d{5}$/.test(pickup) || !/^\d{5}$/.test(delivery)) {
        return setError("Enter valid 5-digit pickup and delivery ZIP codes (or switch to manual miles).");
      }
      setCalculating(true);
      try {
        const pickupCoord = await geocodeZip(pickup);
        const deliveryCoord = await geocodeZip(delivery);
        loadedMiles = haversineMiles(pickupCoord, deliveryCoord) * ROAD_FACTOR;

        if (/^\d{5}$/.test(current)) {
          const currentCoord = await geocodeZip(current);
          deadheadMiles = haversineMiles(currentCoord, pickupCoord) * ROAD_FACTOR;
        } else {
          deadheadMiles = 0;
        }
      } catch {
        setCalculating(false);
        return setError("Could not look up one of those ZIP codes. Check your connection or switch to manual miles.");
      }
      setCalculating(false);
    }

    const totalMiles = deadheadMiles + loadedMiles;
    const deadheadRatio = totalMiles > 0 ? (deadheadMiles / totalMiles) * 100 : 0;
    const grossRpm = loadedMiles > 0 ? grossRateNum / loadedMiles : 0;
    const trueRpm = totalMiles > 0 ? grossRateNum / totalMiles : 0;
    const fuelCost = (totalMiles / mpgNum) * fuelPriceNum;

    const totalHours = transitHoursNum + dwellHoursNum;
    const fixedAllocated = totalHours > 0 ? fixedWeeklyNum * (totalHours / 168) : 0;
    const variableCost = variableCpmNum * totalMiles;
    const totalExpenses = fixedAllocated + variableCost + fuelCost + driverPayNum;
    const cpm = totalMiles > 0 ? totalExpenses / totalMiles : 0;
    const netProfit = grossRateNum - totalExpenses;
    const profitPerHour = totalHours > 0 ? netProfit / totalHours : null;
    const profitPerDay = totalHours > 0 ? netProfit / (totalHours / 24) : null;

    let badge: CalcResults["badge"] = null;
    if (targetRpmNum > 0) {
      if (trueRpm >= targetRpmNum * 1.1) {
        badge = { tone: "positive", label: `Good Load — $${trueRpm.toFixed(2)} RPM vs $${targetRpmNum.toFixed(2)} target` };
      } else if (trueRpm >= targetRpmNum * 0.9) {
        badge = { tone: "warning", label: `Marginal — $${trueRpm.toFixed(2)} RPM vs $${targetRpmNum.toFixed(2)} target` };
      } else {
        badge = { tone: "negative", label: `Below Target — $${trueRpm.toFixed(2)} RPM vs $${targetRpmNum.toFixed(2)} target` };
      }
    } else if (netProfit < 0) {
      badge = { tone: "negative", label: "Losing Money on This Load" };
    }

    setResults({
      deadheadMiles,
      loadedMiles,
      totalMiles,
      deadheadRatio,
      grossRpm,
      trueRpm,
      fuelCost,
      cpm,
      totalExpenses,
      netProfit,
      profitPerHour,
      profitPerDay,
      badge,
    });

    saveSettings({ mpg, targetRpm, fixedWeekly, variableCpm, transitHours, dwellHours });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Route Calculator" subtitle="Deadhead · RPM · Fuel · Profit" />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="mb-4 text-sm text-ink dark:text-dark-ink">Trip</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Current ZIP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="e.g. 60601"
                  value={currentZip}
                  onChange={(e) => setCurrentZip(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Pickup ZIP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="e.g. 46201"
                  value={pickupZip}
                  onChange={(e) => setPickupZip(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="mt-3 w-full rounded-md border border-border px-3 py-2 font-body text-xs font-semibold uppercase tracking-wide text-accent hover:bg-surface-muted disabled:cursor-wait disabled:opacity-60 dark:border-dark-border dark:hover:bg-dark-surface-muted"
            >
              📍 {locating ? "Locating…" : "Use My Location"}
            </button>
            {locationHint && (
              <p className="mt-2 font-body text-xs text-ink-muted dark:text-dark-ink-muted">{locationHint}</p>
            )}

            <div className="mt-3">
              <label className={labelClass}>Delivery ZIP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="e.g. 30301"
                value={deliveryZip}
                onChange={(e) => setDeliveryZip(e.target.value)}
                className={inputClass}
              />
            </div>

            <label className="mt-4 flex items-center gap-2 font-body text-sm text-ink-muted dark:text-dark-ink-muted">
              <input
                type="checkbox"
                checked={manualMode}
                onChange={(e) => setManualMode(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              No signal / prefer to type miles myself
            </label>

            {manualMode && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Deadhead miles</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={manualDeadhead}
                    onChange={(e) => setManualDeadhead(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Loaded miles</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={manualLoaded}
                    onChange={(e) => setManualLoaded(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <p className="mt-3 font-body text-xs text-ink-faint dark:text-dark-ink-muted">
              ZIP lookup uses a free public API — needs a data or wifi connection at calc time.
            </p>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm text-ink dark:text-dark-ink">Load &amp; Fuel</h3>
            <div>
              <label className={labelClass}>Line Haul ($)</label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="2400"
                value={grossRate}
                onChange={(e) => setGrossRate(e.target.value)}
                className={inputClass}
              />
            </div>

            <label className={`${labelClass} mt-3`}>Fuel Price ($/gal)</label>
            <div className="mb-2 flex overflow-hidden rounded-md border border-border dark:border-dark-border">
              {(["avg", "manual"] as FuelMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleFuelModeChange(m)}
                  className={`flex-1 px-3 py-2.5 font-body text-xs font-semibold uppercase tracking-wide transition-colors ${
                    fuelMode === m
                      ? "bg-accent text-white"
                      : "bg-surface text-ink-muted hover:bg-surface-muted dark:bg-dark-surface-muted dark:text-dark-ink-muted"
                  }`}
                >
                  {m === "avg" ? "National Avg" : "Manual"}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="3.85"
              value={fuelPrice}
              readOnly={fuelMode === "avg"}
              onChange={(e) => setFuelPrice(e.target.value)}
              className={`${inputClass} ${fuelMode === "avg" ? "text-accent" : ""}`}
            />
            <p className="mt-1.5 font-body text-xs text-ink-muted dark:text-dark-ink-muted">{fuelPriceHint}</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Truck MPG</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  placeholder="6.5"
                  value={mpg}
                  onChange={(e) => setMpg(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Target RPM ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="2.00"
                  value={targetRpm}
                  onChange={(e) => setTargetRpm(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </Card>

          <Card>
            <details>
              <summary className="cursor-pointer font-body text-sm font-semibold uppercase tracking-wide text-accent">
                Operating Costs &amp; Time (saved on this device)
              </summary>
              <div className="mt-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Fixed Costs / Week ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="1400"
                      value={fixedWeekly}
                      onChange={(e) => setFixedWeekly(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Variable Cost / Mile ($)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0.18"
                      value={variableCpm}
                      onChange={(e) => setVariableCpm(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="font-body text-xs text-ink-faint dark:text-dark-ink-muted">
                  Fixed = truck/trailer payment + insurance + ELD + permits. Variable = maintenance reserve + tires,
                  per mile.
                </p>

                <div>
                  <label className={labelClass}>Driver Pay for this Load ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={driverPay}
                    onChange={(e) => setDriverPay(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <p className="font-body text-xs text-ink-faint dark:text-dark-ink-muted">
                  Leave at 0 if you're the owner-operator keeping the load profit as your own pay. Set a number if
                  this load pays a company driver separately.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Transit Time (hrs)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="8"
                      value={transitHours}
                      onChange={(e) => setTransitHours(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Dwell Time (hrs)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="2"
                      value={dwellHours}
                      onChange={(e) => setDwellHours(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </details>
          </Card>

          <button
            type="button"
            onClick={calculate}
            disabled={calculating}
            className="rounded-md bg-accent px-6 py-4 font-body text-base font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
          >
            {calculating ? "Looking up ZIP codes…" : "Calculate"}
          </button>

          {error && (
            <p className="rounded-md bg-negative-muted p-3 font-body text-sm text-negative">{error}</p>
          )}

          <p className="font-body text-xs text-ink-faint dark:text-dark-ink-muted">
            Distance = straight-line (haversine) between ZIP centroids × 1.17 road-miles factor, or your manual
            entry. National Avg fuel price is EIA's weekly on-highway diesel survey (live where configured,
            otherwise a periodic snapshot). Treat both as estimates — verify against your ELD/GPS mileage and local
            pump price before quoting a rate.
          </p>
        </div>

        <div className="lg:sticky lg:top-6">
          {results ? (
            <Card className="border-2 border-accent">
              <h3 className="mb-3 text-sm text-ink dark:text-dark-ink">Results</h3>
              {results.badge && (
                <div className="mb-4">
                  <StatusBadge tone={results.badge.tone}>{results.badge.label}</StatusBadge>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetricTile label="True RPM (total miles)" value={fmt3(results.trueRpm)} />
                <MetricTile label="Deadhead Miles" value={fmtMi(results.deadheadMiles)} />
                <MetricTile label="Loaded Miles" value={fmtMi(results.loadedMiles)} />
                <MetricTile label="Total Miles" value={fmtMi(results.totalMiles)} />
                <MetricTile label="Deadhead Ratio" value={`${results.deadheadRatio.toFixed(1)}%`} />
                <MetricTile label="Line Haul RPM (loaded)" value={fmt3(results.grossRpm)} />
                <MetricTile label="Fuel Cost Est." value={formatCurrency(results.fuelCost)} />
              </div>

              <div className="my-4 border-t border-border dark:border-dark-border" />

              <div className="grid grid-cols-2 gap-3">
                <MetricTile label="Cost / Mile (CPM)" value={fmt3(results.cpm)} />
                <MetricTile label="Total Expenses" value={formatCurrency(results.totalExpenses)} />
                <div className="col-span-2">
                  <MetricTile
                    label="Net Profit / Load"
                    value={formatCurrency(results.netProfit)}
                    tone={results.netProfit >= 0 ? "positive" : "negative"}
                  />
                </div>
                <MetricTile
                  label="Profit / Hour"
                  value={results.profitPerHour === null ? "—" : formatCurrency(results.profitPerHour)}
                />
                <MetricTile
                  label="Profit / Day"
                  value={results.profitPerDay === null ? "—" : formatCurrency(results.profitPerDay)}
                />
              </div>
            </Card>
          ) : (
            <Card className="flex items-center justify-center border-dashed py-16 text-center">
              <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
                Fill in the trip and load details, then hit Calculate to see deadhead, RPM, fuel cost, and profit.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
