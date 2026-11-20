import { URL, fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Dev talks to the gateway only: /api and /ws are proxied, base URL stays empty.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
  build: {
    // Charts are the heaviest dependency and only the dashboard/engagement need
    // them; keeping them out of the entry chunk shortens first load.
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          query: ["@tanstack/react-query"],
          react: ["react", "react-dom", "react-router"],
          ui: ["radix-ui", "lucide-react", "sonner"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
