# Mayomile Trucking — Operations Dashboard

Two deployables, one repo:

- **`/app`** — React + Vite + TypeScript + Tailwind frontend, deployed as an
  Azure Static Web App.
- **`/api`** — Azure Functions (Node.js 22, TypeScript) backend, one
  HTTP-triggered function per endpoint, reading from Azure SQL Database
  `mayomilesql1` via `mssql` + Azure AD auth (service principal — see
  [Authentication](#authentication-microsoft-entra-id-2-user-allowlist) for
  why, not `DefaultAzureCredential`/managed identity). No passwords or
  connection strings.

**Production:** https://dashboard.mayomile.com (custom domain; the
`*.azurestaticapps.net` default hostname also still works).

## Prerequisites

- Node.js 22+
- [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`func`)
- [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) (`swa`) — installed on demand via `npx`, no global install required
- The [Az PowerShell module](https://learn.microsoft.com/powershell/azure/install-azure-powershell) (`Az.Accounts`), signed in via `Connect-AzAccount` — this is how `DefaultAzureCredential` authenticates to Azure SQL locally (see note below on why this is used instead of `az login`)
- Your Azure AD identity (the one you `Connect-AzAccount` with) must be an
  Azure AD admin/user on the `mayomilesql1` SQL Server with read access to the
  `mayomilesql1` database (`CREATE USER [you@domain.com] FROM EXTERNAL PROVIDER;`
  + appropriate role grants, run once by whoever manages the DB).

## One-time setup

```bash
npm install --prefix app
npm install --prefix api
```

```powershell
Connect-AzAccount
```

```bash
cp api/local.settings.json.example api/local.settings.json
```

Edit `api/local.settings.json` and set `AZURE_SQL_SERVER` to your actual
server hostname (e.g. `mayomile-sql.database.windows.net`). `AZURE_SQL_DATABASE`
is already set to `mayomilesql1`.

`AZURE_TOKEN_CREDENTIALS` is set to `AzurePowerShellCredential` so
`DefaultAzureCredential` authenticates via `Connect-AzAccount` only, instead of
working through its full fallback chain on every request. Two other options
were tried and rejected during setup, for reasons worth knowing if auth breaks
again:
- **`az login` / `AzureCliCredential`** — az-cli's Python HTTP stack
  reliably failed on this machine partway through its post-login tenant/
  subscription-listing calls (a `('Connection aborted.', FileNotFoundError(2,
  'No such file or directory'))` error), while every single one-off HTTPS
  request tested fine, including from the exact same Python interpreter. Az
  PowerShell's `Connect-AzAccount` uses a completely different (.NET/MSAL.NET)
  HTTP stack and doesn't hit this.
- **VS Code sign-in / `VisualStudioCodeCredential`** — on Windows this routes
  through the native account broker (WAM), which requires the same account to
  *also* be linked in Windows under Settings → Accounts → Access work or
  school accounts; being signed into VS Code's Azure Resources extension
  alone isn't enough. This app's server-side `pool.ts` still registers
  `@azure/identity-vscode`'s plugin (note: via CommonJS `require`, not `import`
  — `tedious` loads `@azure/identity` via `require()`, and an ESM import
  would register the plugin on a separate, un-shared module instance), so
  this path is usable if you do that Windows account-link step and switch
  `AZURE_TOKEN_CREDENTIALS` to `VisualStudioCodeCredential`.

`mayomilesql1` runs on Azure SQL's serverless tier, which auto-pauses after
about an hour of inactivity. The first request after a pause has to wait for
it to resume — `pool.ts` sets a 45s connection/request timeout to cover this
(a cold resume took ~11s in testing; the default 15s cut it close). If a
request ever times out anyway, just retry it once the database has resumed.

`EIA_API_KEY` (optional) enables live national-average diesel pricing on the
Route Calculator tab — [register for a free key](https://www.eia.gov/opendata/register.php)
and set it in `api/local.settings.json` (locally) or the Function App's
application settings (in Azure). Without a key, `getDieselPrice.ts` returns a
hardcoded fallback price/date (update the constants in that file
periodically). The key never reaches the browser — the frontend only calls
our own `/api/route-calculator/diesel-price` endpoint.

## Running locally (frontend + API together)

Run the frontend and API as two separate processes, then have `swa` proxy
both into one local URL:

```bash
# terminal 1
npm run dev --prefix app

# terminal 2
cd api
npm run build
func start

# terminal 3, from the repo root
npx @azure/static-web-apps-cli start http://localhost:5173 --api-devserver-url http://localhost:7071
```

Open **http://localhost:4280**.

(`swa start ... --api-location api --run "..."` — the single-command form
SWA's own docs suggest — has a known bug on Windows when the repo path
contains a space: it fails with `'C:\Program' is not recognized as an
internal or external command`, since it doesn't quote the path it hands to
`--run`'s shell command. The three-terminal form above sidesteps it
entirely. Also make sure to invoke `@azure/static-web-apps-cli` by its full
package name — a bare `npx swa` can resolve to an unrelated npm package
that happens to claim the same `swa` binary name.)

If you only need the frontend and don't need the SWA emulator layer (auth
rules, routing config), you can skip `swa` — Vite's dev server proxies
`/api/*` requests to `func start` on port 7071 by itself (see
`app/vite.config.ts`), so `npm run dev --prefix app` alone against
`http://localhost:5173` also works for day-to-day frontend work.

## Project structure

```
/app                  React frontend (Vite)
  /src/components       shared UI primitives (Card, DataTable, MetricTile, ...)
  /src/pages            one folder per tab (loads/, agencies/, ...)
  /src/theme/tokens.ts  ALL colors, fonts, spacing, radii — edit here to restyle
  /src/lib              API client + shared types/formatters
/api                  Azure Functions backend
  /src/functions        one file per endpoint
  /src/db/pool.ts       shared SQL connection pool (Azure AD auth)
staticwebapp.config.json
```

## Adding a new tab

1. Add a page component under `app/src/pages/<tab>/`.
2. Wire it into the route table and nav items in `app/src/App.tsx` and
   `app/src/components/Sidebar.tsx`.
3. Add any new endpoints as their own file under `api/src/functions/`.

## Scope of this build

**Loads**, **Reports**, and **Route Calculator** have real functionality;
**Agencies**, **Weekly Settlements**, and **Settings** are still placeholder
"Coming soon" pages using the same shell, ready to be built out next.

**Loads** — table, real-time search/filter bar (load #, city/state, pickup
date range), sortable columns, weekly settlement panel, load detail view,
and a "Most Recent Load" KPI card.

**Reports** — three dashboards over the database's analytics views, each its
own tab: **Executive Performance** (weekly/monthly revenue composition,
net-profit-vs-RPM combo chart, RPM trend, all against a shared date-range
filter), **Fleet Efficiency** (truck idle time, fuel surcharge recovery,
haul-length distribution, agency performance ranking), and **Data Quality**
(incomplete-financial-data and gross-pay-variance checks as KPI cards +
tables). Charts use [Recharts](https://recharts.org/); that page is
lazy-loaded (`React.lazy` in `App.tsx`) so its ~440KB chunk doesn't load for
users who never visit Reports. Not every view has a date column — agency
performance, haul-length buckets, and the data-quality checks are
all-time/current-state and aren't affected by the date-range filter; the
page says so next to the filter.

**Route Calculator** — ported from the standalone MayoMile Load Calculator
(previously its own `index.html` at routes.mayomile.com), restyled onto this
app's design tokens and shared components rather than its original
charcoal/orange theme. Same formulas and rounding as the original: ZIP-based
geocoding (haversine × 1.17 road-factor) with a manual-miles fallback, "Use
My Location" via browser geolocation + reverse-geocoding, national-average
diesel price with a manual override, and RPM computed against total miles
(loaded + deadhead), not just loaded miles. The EIA API key moved server-side
(`getDieselPrice.ts`) instead of being entered per-device in
`localStorage`, as it was in the original — see the `EIA_API_KEY` note above.
Everything else (MPG, target RPM, fixed/variable costs, transit/dwell hours)
still persists client-side in `localStorage`, same as before.

## Authentication (Microsoft Entra ID, 2-user allowlist)

This app is a **static SPA (Vite) + stateless Azure Functions** — there's no
server process to hold a session or run middleware, so frameworks like
NextAuth.js or Passport-Azure-AD don't apply here (nothing to run them *on*).
Instead, this uses **Azure Static Web Apps' built-in Entra ID auth**: route
protection is declarative config (`staticwebapp.config.json`), enforced by
the SWA edge *before* a request ever reaches our app code — not bypassable by
a client-side routing bug the way app-level middleware can be. Enforcement is
layered at both the identity level (Entra) and the app level (a serverless
role-assignment function), matching the "2 users only, both layers" goal.

### Phase 1 — Entra admin center (portal steps, one-time)

**App registration:**
1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `MayoMile Operations Dashboard`. Supported account types:
   **Accounts in this organizational directory only** (single tenant — this
   app has exactly 2 known users, no reason to allow other tenants or
   personal Microsoft accounts).
3. Redirect URI: platform **Web**,
   `https://<your-swa-hostname>/.auth/login/aad/callback` — this exact path
   is fixed by Static Web Apps, not something we choose. Find
   `<your-swa-hostname>` on the SWA resource's Overview page (or your custom
   domain, once one is attached). If you also want to test the *real*
   Microsoft login flow locally (optional — see Phase 4), add a second
   Web redirect URI: `http://localhost:4280/.auth/login/aad/callback`.
4. After creation, copy the **Application (client) ID** and **Directory
   (tenant) ID** from the Overview page.
5. **Certificates & secrets** → **New client secret** → set an expiration
   (put a calendar reminder — an expired secret is an outage, not a warning)
   → copy the secret **value** immediately; it's never shown again.

**Restrict sign-in to exactly 2 users:**
1. Entra ID → **Enterprise applications** → find the same app (it's
   auto-created alongside the App Registration) → **Properties**.
2. **Assignment required?** → **Yes** → **Save**. This is the important
   step: without it, *any* user in the tenant can complete sign-in.
3. **Users and groups** → **Add user/group** → add your 2 authorized
   accounts only. An unassigned user now gets rejected by Microsoft's own
   login page (error AADSTS50105) — they never even reach this app.

### Phase 2 — Where the settings actually live

There's no `.env.local` / `.env.production` here — a Vite frontend is 100%
static files with no server to read a `.env` file at runtime, and anything
placed in one gets bundled into public JS (the opposite of secret storage).
The two secret-holding pieces are separate Azure resources with their own
settings:

**There is only one settings store**, not two — the co-located/managed
Functions API (`api-location` deploy model) shares the same Application
Settings as the Static Web App resource itself (Portal → your SWA →
**Configuration** → **Application settings**, or `New-AzStaticWebAppSetting` /
`az staticwebapp appsettings set`). All of these must be set there for the
app to work at all:
```
AZURE_CLIENT_ID       = <Application (client) ID from Phase 1>
AZURE_CLIENT_SECRET   = <client secret value from Phase 1>
AZURE_TENANT_ID       = <Directory (tenant) ID from Phase 1>
AUTHORIZED_USERS      = user1@yourdomain.com,user2@yourdomain.com
AZURE_SQL_SERVER      = your-server-name.database.windows.net
AZURE_SQL_DATABASE    = mayomilesql1
EIA_API_KEY           = <if using the route calculator>
APPLICATIONINSIGHTS_CONNECTION_STRING = <from an Application Insights resource — see below>
```
`AZURE_CLIENT_ID`/`SECRET` are read by `staticwebapp.config.json`'s
`clientIdSettingName`/`clientSecretSettingName` for sign-in, **and** by
`api/src/db/pool.ts` for SQL auth (see below) — same app registration, two
uses. `AUTHORIZED_USERS` is comma-separated, matched case-insensitively
against the signed-in user's UPN, read by `getRoles.ts`; if empty or unset it
**denies everyone** rather than defaulting open — verified in Phase 4.

⚠️ **`New-AzStaticWebAppSetting` (and `az staticwebapp appsettings set`)
REPLACES the entire settings dictionary — it does not merge.** Setting one
key wipes out every other key that isn't included in the same call. Always
read the current settings first and include all of them, plus your change,
in one call — this cost real production downtime once (wiped
`AZURE_CLIENT_ID`/`SECRET` while only trying to add `AUTHORIZED_USERS`).

**SQL authentication uses a service principal, not managed identity.**
`DefaultAzureCredential` / managed identity was the first approach (no
shared secret needed), but Azure Static Web Apps' co-located/managed
Functions (this project's `api-location` deploy model) don't expose a
managed identity endpoint to the runtime at all —
`ManagedIdentityCredential` never even appears in
`DefaultAzureCredential`'s attempted-credential chain, confirmed via
Application Insights traces. A standalone "bring your own" linked Function
App would support managed identity, but that's a bigger re-architecture.
Instead, `pool.ts` authenticates as the same app registration from Phase 1
via `azure-active-directory-service-principal-secret`. That app registration
needs its own SQL grant, run once as the SQL server's AAD admin:
```sql
CREATE USER [<app registration display name>] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [<app registration display name>];
```
(Matched by display name, e.g. `Mayo Mile Operations` — not by client ID.)
If the app registration's client secret is ever rotated, no SQL change is
needed since the grant is tied to the app identity, not the secret.

Also replace the placeholder tenant ID baked into
`staticwebapp.config.json`'s `openIdIssuer` (`00000000-0000-0000-0000-000000000000`)
with your real Directory (tenant) ID from Phase 1. It's deliberately a
syntactically-valid dummy GUID rather than a `<TENANT_ID>`-style placeholder —
the SWA CLI parses this URL even when just booting up locally, and an
angle-bracket placeholder makes that parsing throw (a real bug I hit and fixed
while building this — see Phase 4 for how I verified the fix).

**Don't add an explicit public route for the `rolesSource` path** (e.g. a
`{"route": "/api/GetRoles", "allowedRoles": ["anonymous"]}` rule). Once a
path is declared as `auth.rolesSource`, Static Web Apps reserves it for its
own internal invocation during sign-in — an explicit route rule for the same
path collides with that and made *external* test requests 404, even though
the real internal call (and therefore real sign-in) worked fine the whole
time. Curling the roles endpoint directly is not a valid way to test it once
it's wired up as `rolesSource`; test via an actual sign-in and `/.auth/me`
instead.

**No Application Insights means no visibility into managed-Functions
errors** — there's no Kudu/log-stream access for this co-located deploy
model, so without `APPLICATIONINSIGHTS_CONNECTION_STRING` set, a failing
function just returns a generic wrapped error with the real exception
invisible. `host.json` already has `applicationInsights` sampling
configured; it just needs a connection string to actually start capturing.

Also replace the placeholder tenant ID baked into
`staticwebapp.config.json`'s `openIdIssuer` (`00000000-0000-0000-0000-000000000000`)
with your real Directory (tenant) ID from Phase 1. It's deliberately a
syntactically-valid dummy GUID rather than a `<TENANT_ID>`-style placeholder —
the SWA CLI parses this URL even when just booting up locally, and an
angle-bracket placeholder makes that parsing throw (a real bug I hit and fixed
while building this — see Phase 4 for how I verified the fix).

### Phase 3 — Code (already in this repo)

1. **[`staticwebapp.config.json`](staticwebapp.config.json)** — the access
   guard. Every route requires the `authorized` role (assigned only by
   `getRoles.ts`, never automatically); `/.auth/*` and `/403.html` stay
   reachable without it, since you need to hit the login/logout endpoints
   and see the denial page as an unauthenticated or unauthorized user.
   `responseOverrides` sends a 401 (not signed in) straight to
   `/.auth/login/aad`, and a 403 (signed in, not on the allowlist) to a
   custom denied page instead of SWA's generic default.
2. **[`api/src/functions/getRoles.ts`](api/src/functions/getRoles.ts)** — the
   runtime verification. SWA POSTs the signed-in user's claims here
   automatically right after every login; it checks `userDetails` (the UPN)
   against `AUTHORIZED_USERS` and returns `{ roles: ["authorized"] }` or
   `{ roles: [] }`. This is what actually enforces the allowlist at the app
   layer — the Enterprise Application restriction in Phase 1 stops
   unauthorized sign-in at the identity layer, this stops unauthorized
   *access* even if that were ever misconfigured.
3. **[`app/public/403.html`](app/public/403.html)** — the branded "access
   denied" page (standalone static HTML on the app's actual palette, not a
   React route, so it renders reliably even before/without the SPA bundle).
4. **[`app/src/components/UserMenu.tsx`](app/src/components/UserMenu.tsx)** —
   reads `/.auth/me` (SWA's built-in "who am I" endpoint) and renders the
   signed-in user's email + a sign-out link in the header. Renders nothing
   when there's no session (e.g. plain `vite` dev without the `swa`
   emulator), so it degrades gracefully rather than erroring.

There's no custom "Sign in with Microsoft" landing page to build — SWA
redirects unauthenticated requests straight to Microsoft's own login (the
401 `responseOverrides` rule above), which is the standard, expected UX for
this pattern rather than an interstitial page to click through.

### Phase 4 — Testing & verification

**What I verified while building this** (you should re-run these after
filling in your real tenant ID / client ID / secret / allowlist):

- `getRoles.ts` allowlist logic, directly — spun up an isolated `func start`
  instance and POSTed simulated SWA principal payloads:
  ```bash
  curl -X POST http://localhost:7072/api/GetRoles -H "Content-Type: application/json" \
    -d '{"identityProvider":"aad","userId":"abc","userDetails":"authorized@example.com","claims":[]}'
  # -> {"roles":["authorized"]}   (and case-insensitively, both allowlisted users)

  curl -X POST http://localhost:7072/api/GetRoles -H "Content-Type: application/json" \
    -d '{"identityProvider":"aad","userId":"xyz","userDetails":"someone-else@example.com","claims":[]}'
  # -> {"roles":[]}
  ```
- Fail-closed behavior — with `AUTHORIZED_USERS` empty, even a
  would-be-authorized email got `{"roles":[]}`, with a warning logged.
  Misconfiguration denies everyone; it never accidentally grants access.
- `staticwebapp.config.json` loads and its route rules take effect —
  confirmed `GET /` 302-redirects to `/.auth/login/aad` when unauthenticated.

**What I could *not* verify locally, and why:** completing the actual
Microsoft sign-in flow needs real `AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET`
(the SWA CLI requires them the moment a custom `azureActiveDirectory`
registration is configured — confirmed via a clean `AZURE_CLIENT_ID not
found` error, not a guess) plus a live app registration in your tenant. That
only exists once you've done Phase 1. Full manual test scenario once it's
deployed (or once you've supplied real local credentials + the
`localhost:4280` redirect URI from Phase 1):

1. **Authorized sign-in (User 1 and User 2):** visit the app's root URL
   signed out → redirected to Microsoft login → sign in as User 1 → land
   back in the app, `/.auth/me` (and the header) shows their email → repeat
   for User 2.
2. **Unauthorized user, same tenant:** sign in as a third, non-allowlisted
   account. Two independent checks, either of which should stop them:
   - If Enterprise App assignment (Phase 1) is set to Required and they're
     not assigned, Microsoft's own login page rejects them (AADSTS50105) —
     they never reach the app at all.
   - If they *do* complete login (e.g. assignment restriction temporarily
     off), `getRoles.ts` returns no roles, `staticwebapp.config.json` denies
     the `authorized`-gated routes, and they land on `/403.html`.
3. **Deep link while signed out:** with no session, request a specific
   inner page directly, e.g. `/route-calculator` (not just `/`) →
   confirm the 401 → `/.auth/login/aad` redirect fires for it too, not just
   the root, and that after signing in you land back on `/route-calculator`
   (`post_login_redirect_uri=.referrer` in the config) rather than always
   bouncing to the default page.
