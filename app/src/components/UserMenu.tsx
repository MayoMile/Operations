import { useEffect, useState } from "react";

interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
}

/** Reads the signed-in user from Static Web Apps' built-in /.auth/me
 * endpoint and offers a sign-out link. Returns null (renders nothing) when
 * running outside the SWA auth layer — e.g. local `vite` dev without the
 * `swa` emulator — so it degrades gracefully rather than erroring. */
export function UserMenu() {
  const [principal, setPrincipal] = useState<ClientPrincipal | null>(null);

  useEffect(() => {
    fetch("/.auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPrincipal(data?.clientPrincipal ?? null))
      .catch(() => setPrincipal(null));
  }, []);

  if (!principal) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="font-body text-xs text-ink-muted dark:text-dark-ink-muted">
        {principal.userDetails}
      </span>
      <a
        href="/.auth/logout?post_logout_redirect_uri=/"
        className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium text-ink-muted hover:bg-surface-muted dark:border-dark-border dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
      >
        Sign out
      </a>
    </div>
  );
}
