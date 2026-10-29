import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Backend address for the dev proxy. Override in frontend/.env.local (gitignored) when the default port is
// taken, e.g. by another worktree: VITE_API_TARGET=127.0.0.1:8001
export default defineConfig(({ mode }) => {
  const api = loadEnv(mode, process.cwd(), "VITE_").VITE_API_TARGET || "127.0.0.1:8000";
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": "/src" } },
    server: {
      port: 5173,
      proxy: { "/api": `http://${api}`, "/ws": { target: `ws://${api}`, ws: true } },
    },
  };
});
