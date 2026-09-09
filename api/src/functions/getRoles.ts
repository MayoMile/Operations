import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// Static Web Apps calls this automatically, right after a successful Entra ID
// sign-in, to decide what roles the user gets for THIS SESSION — it's the
// runtime enforcement layer behind the AUTHORIZED_USERS allowlist. Route
// rules in staticwebapp.config.json then require the "authorized" role on
// every route, so anyone who signs in but isn't on the list gets a 403
// (routed to /403.html) rather than access to the app. This complements,
// not replaces, restricting sign-in itself via the Enterprise Application's
// "Assignment required" setting in Entra — that stops an unlisted user from
// completing login at all; this stops them from getting in even if that
// were ever misconfigured.
//
// SWA's platform invokes this route directly; it is not meant to be called
// by the browser, so authLevel "anonymous" here is intentional, not a gap —
// see https://learn.microsoft.com/azure/static-web-apps/authentication-custom#manage-roles-with-a-serverless-api-function

interface StaticWebAppsClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  claims?: { typ: string; val: string }[];
}

function getAuthorizedUsers(): string[] {
  return (process.env.AUTHORIZED_USERS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getRoles(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const authorizedUsers = getAuthorizedUsers();
  if (authorizedUsers.length === 0) {
    context.warn("AUTHORIZED_USERS is not configured — denying all role assignments.");
    return { jsonBody: { roles: [] } };
  }

  let principal: StaticWebAppsClientPrincipal;
  try {
    principal = (await request.json()) as StaticWebAppsClientPrincipal;
  } catch (err) {
    context.error("GetRoles: could not parse request body", err);
    return { jsonBody: { roles: [] } };
  }

  // For the azureActiveDirectory provider, userDetails is the signed-in
  // user's UPN (their email, for this tenant).
  const email = (principal.userDetails ?? "").trim().toLowerCase();
  if (!email) {
    return { jsonBody: { roles: [] } };
  }

  const isAuthorized = authorizedUsers.includes(email);
  if (!isAuthorized) {
    context.warn(`GetRoles: authenticated but not on the allowlist — denied: ${email}`);
  }

  return { jsonBody: { roles: isAuthorized ? ["authorized"] : [] } };
}

app.http("getRoles", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "GetRoles",
  handler: getRoles,
});
