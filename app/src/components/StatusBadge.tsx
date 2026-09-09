type Tone = "neutral" | "positive" | "negative" | "warning";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-ink-muted",
  positive: "bg-positive-muted text-positive",
  negative: "bg-negative-muted text-negative",
  warning: "bg-warning-muted text-warning",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 font-body text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
