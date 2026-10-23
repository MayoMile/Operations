import { sql } from "../db/pool.js";

// Agency codes that belong to the same company are merged into one group when
// they share a phone number or email. Name check: two codes only merge if the
// first word of their names matches, because a data mix-up (one agency's
// contact info appearing on another agency's load) would otherwise chain
// unrelated companies together through the shared value.

export interface AgencyCode {
  code: string;
  name: string;
}

export interface AgencySummary {
  id: string;
  name: string;
  codes: AgencyCode[];
  load_count: number;
  total_revenue: number;
  avg_revenue_per_load: number | null;
  weighted_rpm: number | null;
  deadhead_pct: number | null;
  first_load_date: Date | null;
  last_load_date: Date | null;
  contact_count: number;
}

export interface AgencyOverall {
  load_count: number;
  weighted_rpm: number | null;
  deadhead_pct: number | null;
}

export interface AgencyContact {
  phone_number: string | null;
  email: string | null;
}

export interface PossibleMatch {
  id: string;
  name: string;
}

export interface AgencyGroup {
  summary: AgencySummary;
  contacts: AgencyContact[];
  possible_matches: PossibleMatch[];
}

export interface AgencyGroups {
  groups: AgencyGroup[];
  byCode: Map<string, AgencyGroup>;
  overall: AgencyOverall;
}

function normalizePhone(value: unknown): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || email === "null" || email.endsWith("@mayomile.local")) return null;
  return email;
}

function firstWord(name: string): string {
  return (name.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export async function loadAgencyGroups(pool: sql.ConnectionPool): Promise<AgencyGroups> {
  const [agencyRows, contactRows, loadContactRows, statRows] = await Promise.all([
    pool.request().query(`SELECT RTRIM(agency_code) AS code, agency_name AS name FROM dbo.Agencies`),
    pool
      .request()
      .query(`SELECT RTRIM(agency_code) AS code, phone_number, email FROM dbo.AgencyContacts`),
    pool
      .request()
      .query(`SELECT DISTINCT RTRIM(agency_code) AS code, phone_number, email FROM dbo.Loads`),
    pool.request().query(`
      SELECT RTRIM(agency_code) AS code,
        COUNT(*) AS load_count,
        SUM(gross_to_the_truck) AS revenue,
        SUM(total_miles) AS miles,
        SUM(CASE WHEN deadhead IS NOT NULL THEN deadhead END) AS deadhead_miles,
        SUM(CASE WHEN deadhead IS NOT NULL THEN total_miles END) AS deadhead_basis_miles,
        MIN(pickup_date) AS first_pickup,
        MAX(pickup_date) AS last_pickup
      FROM dbo.Loads
      GROUP BY RTRIM(agency_code)
    `),
  ]);

  const nameOf = new Map<string, string>();
  for (const a of agencyRows.recordset) nameOf.set(a.code, a.name);
  const codes = [...nameOf.keys()];

  const stats = new Map<string, (typeof statRows.recordset)[number]>();
  for (const s of statRows.recordset) stats.set(s.code, s);

  // Union-find over agency codes.
  const parent = new Map<string, string>(codes.map((c) => [c, c]));
  const find = (c: string): string => {
    let root = c;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(c, root);
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));

  const codesByContactKey = new Map<string, Set<string>>();
  for (const row of [...contactRows.recordset, ...loadContactRows.recordset]) {
    if (!nameOf.has(row.code)) continue;
    const keys = [
      normalizePhone(row.phone_number) && `phone:${normalizePhone(row.phone_number)}`,
      normalizeEmail(row.email) && `email:${normalizeEmail(row.email)}`,
    ];
    for (const key of keys) {
      if (!key) continue;
      if (!codesByContactKey.has(key)) codesByContactKey.set(key, new Set());
      codesByContactKey.get(key)!.add(row.code);
    }
  }

  const blockedPairs: [string, string][] = [];
  for (const sharing of codesByContactKey.values()) {
    const list = [...sharing];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        if (firstWord(nameOf.get(a)!) === firstWord(nameOf.get(b)!)) union(a, b);
        else blockedPairs.push([a, b]);
      }
    }
  }

  const membersByRoot = new Map<string, string[]>();
  for (const code of codes) {
    const root = find(code);
    if (!membersByRoot.has(root)) membersByRoot.set(root, []);
    membersByRoot.get(root)!.push(code);
  }

  const loadCount = (code: string) => Number(stats.get(code)?.load_count ?? 0);
  const groupIdOf = new Map<string, string>();
  const groups: AgencyGroup[] = [];

  for (const members of membersByRoot.values()) {
    members.sort((a, b) => loadCount(b) - loadCount(a) || a.localeCompare(b));
    const id = members[0];
    for (const code of members) groupIdOf.set(code, id);

    let loads = 0, revenue = 0, miles = 0, deadheadMiles = 0, deadheadBasis = 0;
    let first: Date | null = null;
    let last: Date | null = null;
    for (const code of members) {
      const s = stats.get(code);
      if (!s) continue;
      loads += Number(s.load_count);
      revenue += Number(s.revenue ?? 0);
      miles += Number(s.miles ?? 0);
      deadheadMiles += Number(s.deadhead_miles ?? 0);
      deadheadBasis += Number(s.deadhead_basis_miles ?? 0);
      if (s.first_pickup && (!first || s.first_pickup < first)) first = s.first_pickup;
      if (s.last_pickup && (!last || s.last_pickup > last)) last = s.last_pickup;
    }

    const seenContacts = new Set<string>();
    const contacts: AgencyContact[] = [];
    for (const row of contactRows.recordset) {
      if (!members.includes(row.code)) continue;
      const dedupeKey = `${normalizePhone(row.phone_number) ?? ""}|${normalizeEmail(row.email) ?? ""}`;
      if (dedupeKey === "|" || seenContacts.has(dedupeKey)) continue;
      seenContacts.add(dedupeKey);
      contacts.push({ phone_number: row.phone_number ?? null, email: row.email ?? null });
    }

    // "Taylor Shipping Solutions LLC - ALA" -> drop the trailing " - <code>" tag.
    const displayName = nameOf
      .get(id)!
      .replace(new RegExp(`\\s*-\\s*(${members.join("|")})\\s*$`, "i"), "")
      .trim();

    const deadheadRatio = ratio(deadheadMiles, deadheadBasis);
    groups.push({
      summary: {
        id,
        name: displayName,
        codes: members.map((code) => ({ code, name: nameOf.get(code)! })),
        load_count: loads,
        total_revenue: revenue,
        avg_revenue_per_load: ratio(revenue, loads),
        weighted_rpm: ratio(revenue, miles),
        deadhead_pct: deadheadRatio === null ? null : deadheadRatio * 100,
        first_load_date: first,
        last_load_date: last,
        contact_count: contacts.length,
      },
      contacts,
      possible_matches: [],
    });
  }

  const byId = new Map(groups.map((g) => [g.summary.id, g]));
  const byCode = new Map<string, AgencyGroup>();
  for (const [code, id] of groupIdOf) byCode.set(code.toUpperCase(), byId.get(id)!);

  for (const [a, b] of blockedPairs) {
    const ga = byCode.get(a.toUpperCase())!;
    const gb = byCode.get(b.toUpperCase())!;
    if (ga === gb) continue;
    if (!ga.possible_matches.some((m) => m.id === gb.summary.id)) {
      ga.possible_matches.push({ id: gb.summary.id, name: gb.summary.name });
    }
    if (!gb.possible_matches.some((m) => m.id === ga.summary.id)) {
      gb.possible_matches.push({ id: ga.summary.id, name: ga.summary.name });
    }
  }

  groups.sort((a, b) => b.summary.load_count - a.summary.load_count || a.summary.name.localeCompare(b.summary.name));

  let totalLoads = 0, totalRevenue = 0, totalMiles = 0, totalDeadhead = 0, totalDeadheadBasis = 0;
  for (const s of stats.values()) {
    totalLoads += Number(s.load_count);
    totalRevenue += Number(s.revenue ?? 0);
    totalMiles += Number(s.miles ?? 0);
    totalDeadhead += Number(s.deadhead_miles ?? 0);
    totalDeadheadBasis += Number(s.deadhead_basis_miles ?? 0);
  }
  const overallDeadhead = ratio(totalDeadhead, totalDeadheadBasis);

  return {
    groups,
    byCode,
    overall: {
      load_count: totalLoads,
      weighted_rpm: ratio(totalRevenue, totalMiles),
      deadhead_pct: overallDeadhead === null ? null : overallDeadhead * 100,
    },
  };
}
