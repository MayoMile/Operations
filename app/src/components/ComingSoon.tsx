import { PageHeader } from "./PageHeader";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-24 dark:border-dark-border">
        <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
          Coming soon — {title} isn't built yet.
        </p>
      </div>
    </div>
  );
}
