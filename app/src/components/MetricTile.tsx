type Tone = "neutral" | "positive" | "negative" | "warning";

interface MetricTileProps {
  label: string;
  value: string;
  tone?: Tone;
  hint?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "text-ink dark:text-dark-ink",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
};

export function MetricTile({ label, value, tone = "neutral", hint }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 dark:border-dark-border dark:bg-dark-surface">
      <p className="font-body text-xs uppercase tracking-wide text-ink-muted dark:text-dark-ink-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${TONE_CLASSES[tone]}`}>
        {value}
      </p>
      {hint && (
        <p className="mt-1 font-body text-xs text-ink-faint dark:text-dark-ink-muted">{hint}</p>
      )}
    </div>
  );
}
