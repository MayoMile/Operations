import { tokens } from "./tokens";

/**
 * Recharts needs literal color values (SVG fill/stroke), not Tailwind
 * classes, so this mirrors the relevant tokens from tokens.ts as hex
 * strings. Keep this in sync with tokens.ts when the palette changes —
 * these values are chosen to stay legible on both the light paper and dark
 * surface backgrounds, since charts don't re-theme per dark mode.
 */
export const chartColors = {
  accent: tokens.colors.accent,
  accentHover: tokens.colors["accent-hover"],
  accentMuted: tokens.colors["accent-muted"],
  positive: tokens.colors.positive,
  negative: tokens.colors.negative,
  warning: tokens.colors.warning,
  ink: tokens.colors.ink,
  grid: "#8a8272",
  series: [
    tokens.colors.accent,
    tokens.colors.positive,
    tokens.colors["ink-muted"],
    tokens.colors.negative,
    tokens.colors.warning,
  ],
} as const;
