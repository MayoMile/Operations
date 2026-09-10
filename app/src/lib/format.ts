export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatMiles(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 0 })} mi`;
}

export function formatRPM(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(1)}%`;
}

/** Formats a datetime string (e.g. from the API's pickup_date/delivery_date,
 * which come back as UTC ISO strings like "2026-07-19T00:01:00.000Z") using
 * its UTC calendar date, not the viewer's local timezone. These columns are
 * a business calendar day with an irrelevant embedded time-of-day — reading
 * them in local time would roll the day back for any viewer west of UTC
 * whenever the stored time is earlier than the local offset (e.g. every US
 * timezone, for a time near midnight UTC). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Formats a bare "YYYY-MM-DD" string (e.g. from a date-range input) without
 * the UTC-midnight-to-local-time shift `formatDate`/`new Date(value)` would
 * introduce — that shift rolls the displayed day back by one in any
 * timezone behind UTC. */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "—";
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Strips a ZIP+4 extension so only the primary 5-digit ZIP renders, e.g.
 * "Dallas, TX 75261-4033" -> "Dallas, TX 75261". Locations with a plain
 * 5-digit ZIP (no extension) pass through unchanged. */
export function formatLocation(location: string | null | undefined): string {
  if (!location) return "—";
  return location.replace(/(\d{5})-\d{4}\b/, "$1");
}

export function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/** Monday of the given ISO week, as a "YYYY-MM-DD" string — lets weekly
 * aggregate rows (week_number/week_year) be compared against a plain date
 * range without a full calendar library. */
export function weekToMonday(week: number, year: number): string {
  const monday = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const day = monday.getUTCDay() || 7;
  monday.setUTCDate(monday.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}
