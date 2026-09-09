import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between border-b border-border pb-4 dark:border-dark-border">
      <div>
        <h2 className="text-2xl text-ink dark:text-dark-ink">{title}</h2>
        {subtitle && (
          <p className="mt-1 font-body text-sm normal-case tracking-normal text-ink-muted dark:text-dark-ink-muted">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
