import type { ReactNode } from "react";
import { Card } from "./Card";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className = "" }: ChartCardProps) {
  return (
    <Card className={className}>
      <h3 className="text-sm text-ink dark:text-dark-ink">{title}</h3>
      {subtitle && (
        <p className="mb-3 mt-0.5 font-body text-xs text-ink-muted dark:text-dark-ink-muted">
          {subtitle}
        </p>
      )}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </Card>
  );
}
