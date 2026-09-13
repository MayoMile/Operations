import { NavLink } from "react-router-dom";
import logo from "@/assets/mayomile-logo.png";

const NAV_ITEMS = [
  { to: "/loads", label: "Loads" },
  { to: "/agencies", label: "Agencies" },
  { to: "/settlements", label: "Settlements" },
  { to: "/route-calculator", label: "Route Calculator" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-surface dark:border-dark-border dark:bg-dark-surface">
      <div className="border-b border-border px-4 py-5 dark:border-dark-border">
        <img src={logo} alt="MayoMile" className="h-8 w-auto" />
        <p className="mt-2 font-body text-xs normal-case tracking-normal text-ink-muted dark:text-dark-ink-muted">
          Operations Dashboard
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-muted text-accent-hover dark:bg-dark-surface-muted dark:text-accent"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted dark:hover:text-dark-ink",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
