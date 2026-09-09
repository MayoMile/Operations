import { useEffect, useState } from "react";

const STORAGE_KEY = "mayomile-dark-mode";

export function DarkModeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(STORAGE_KEY, dark ? "1" : "0");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="rounded-md border border-border px-3 py-1.5 font-body text-xs font-medium text-ink-muted hover:bg-surface-muted dark:border-dark-border dark:text-dark-ink-muted dark:hover:bg-dark-surface-muted"
    >
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}
