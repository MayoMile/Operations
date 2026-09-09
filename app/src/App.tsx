import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { DarkModeToggle } from "./components/DarkModeToggle";
import { UserMenu } from "./components/UserMenu";
import { LoadsPage } from "./pages/loads/LoadsPage";
import { AgenciesPage } from "./pages/agencies/AgenciesPage";
import { SettlementsPage } from "./pages/settlements/SettlementsPage";
import { RouteCalculatorPage } from "./pages/routecalc/RouteCalculatorPage";
import { SettingsPage } from "./pages/settings/SettingsPage";

// Recharts is a large dependency only Reports needs — code-split it out of
// the main bundle so every other page doesn't pay for it on load.
const ReportsPage = lazy(() =>
  import("./pages/reports/ReportsPage").then((m) => ({ default: m.ReportsPage })),
);

function Shell() {
  return (
    <div className="flex min-h-screen bg-paper text-ink dark:bg-dark-paper dark:text-dark-ink">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-border bg-surface px-6 py-3 dark:border-dark-border dark:bg-dark-surface">
          <UserMenu />
          <DarkModeToggle />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/loads" replace />} />
            <Route path="/loads" element={<LoadsPage />} />
            <Route path="/agencies" element={<AgenciesPage />} />
            <Route path="/settlements" element={<SettlementsPage />} />
            <Route path="/route-calculator" element={<RouteCalculatorPage />} />
            <Route
              path="/reports"
              element={
                <Suspense
                  fallback={
                    <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
                      Loading…
                    </p>
                  }
                >
                  <ReportsPage />
                </Suspense>
              }
            />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/loads" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
