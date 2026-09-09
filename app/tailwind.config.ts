import type { Config } from "tailwindcss";
import { tokens } from "./src/theme/tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      spacing: tokens.spacing,
      borderRadius: tokens.borderRadius,
    },
  },
  plugins: [],
} satisfies Config;
