import sql from "mssql";

// Shared connection pool. Authentication is Azure AD via mssql's
// "azure-active-directory-service-principal-secret" mode, using the same
// app registration already configured for Entra sign-in (AZURE_CLIENT_ID/
// AZURE_CLIENT_SECRET) — no password or connection string with embedded
// credentials, ever. This runs identically locally and in Azure.
//
// Managed identity (DefaultAzureCredential) was tried first, since it needs
// no shared secret at all, but Azure Static Web Apps' co-located/managed
// Functions (the api-location deployment model this project uses) don't
// expose a managed identity endpoint to the runtime — ManagedIdentityCredential
// never even appears in DefaultAzureCredential's attempted-credential chain.
// A standalone "bring your own" linked Function App would support it, but
// that's a bigger re-architecture; service-principal auth works today with
// what's already deployed.
let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;

  const server = process.env.AZURE_SQL_SERVER;
  const database = process.env.AZURE_SQL_DATABASE;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;
  if (!server || !database || !clientId || !clientSecret || !tenantId) {
    throw new Error(
      "AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID must be set (see local.settings.json.example).",
    );
  }

  const config: sql.config = {
    server,
    database,
    authentication: {
      type: "azure-active-directory-service-principal-secret",
      options: { clientId, clientSecret, tenantId },
    },
    options: {
      encrypt: true,
    },
    // mayomilesql1 runs on Azure SQL's serverless tier, which auto-pauses
    // after inactivity — the first connection after a pause has to wait for
    // it to resume, which can take longer than tedious's 15s default.
    connectionTimeout: 45000,
    requestTimeout: 45000,
  };

  try {
    pool = await new sql.ConnectionPool(config).connect();
    return pool;
  } catch (err) {
    throw new Error(`SQL connection failed:\n${describeError(err)}`, { cause: err });
  }
}

// mssql/tedious wrap the real failure reason several layers deep (each
// credential's own rejection inside an AggregateAuthenticationError inside
// tedious's ConnectionError). The default Azure Functions logger only prints
// the outermost message, so flatten the chain here to see what actually failed.
function describeError(err: unknown, depth = 0): string {
  if (!err || typeof err !== "object") return `${"  ".repeat(depth)}${String(err)}`;
  const e = err as { name?: string; message?: string; errors?: unknown[]; originalError?: unknown };
  const lines = [`${"  ".repeat(depth)}${e.name ?? "Error"}: ${e.message ?? err}`];
  if (Array.isArray(e.errors)) {
    for (const inner of e.errors) lines.push(describeError(inner, depth + 1));
  }
  if (e.originalError) lines.push(describeError(e.originalError, depth + 1));
  return lines.join("\n");
}

export { sql };
