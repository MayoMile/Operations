/**
 * Design tokens — the single source of truth for visual style.
 *
 * Nothing outside this file should contain a raw hex value, font name, or
 * magic spacing/radius number. `tailwind.config.ts` imports this object and
 * extends Tailwind's theme with it, so every token here becomes a Tailwind
 * utility class (e.g. `colors.accent` -> `bg-accent`, `text-accent`, etc).
 *
 * This is expected to change often while the visual design is still being
 * iterated on — edit values here, not in individual components.
 */

export const tokens = {
  colors: {
    // Base surfaces — paper-white / light-gray "dispatch board" backgrounds
    paper: "#f7f5f0",
    surface: "#ffffff",
    "surface-muted": "#eeece5",
    border: "#dcd8cc",

    // Ink / text
    ink: "#1f1b16",
    "ink-muted": "#6b6455",
    "ink-faint": "#a39c8a",

    // Brand accent — extracted from the MayoMile logo (road-sign orange +
    // black). Primary actions, active nav, active sort indicators, emphasis.
    accent: "#d96414",
    "accent-hover": "#a34b0f",
    "accent-muted": "#f9e8dc",

    // Financial semantics
    positive: "#4d7c4a",
    "positive-muted": "#e3ecdf",
    negative: "#b3432b",
    "negative-muted": "#f6e2dc",
    warning: "#c68a1a",
    "warning-muted": "#f5e8ce",

    // Dark mode surfaces (opt-in toggle, never default)
    "dark-paper": "#17140f",
    "dark-surface": "#231f18",
    "dark-surface-muted": "#2c2720",
    "dark-border": "#3a352a",
    "dark-ink": "#f2ede2",
    "dark-ink-muted": "#b3a999",
  },

  fontFamily: {
    // Condensed/industrial sans for headings
    heading: ["'Oswald'", "'Arial Narrow'", "sans-serif"],
    // Clean system sans for body copy
    body: [
      "'Inter'",
      "-apple-system",
      "BlinkMacSystemFont",
      "'Segoe UI'",
      "sans-serif",
    ],
    // Monospace for all numeric/dollar/mileage figures so columns align
    mono: ["'JetBrains Mono'", "'Consolas'", "monospace"],
  },

  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
  },

  borderRadius: {
    sm: "0.25rem",
    md: "0.375rem",
    lg: "0.625rem",
  },
} as const;

export type Tokens = typeof tokens;
