import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // When running `vite` standalone (not via `swa start`), forward /api
      // calls to a locally running `func start` instance on port 7071.
      "/api": {
        target: "http://localhost:7071",
        changeOrigin: true,
      },
    },
  },
});
