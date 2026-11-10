import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

// /app/… is the Telegram Mini App (miniapp.html), everything else the ERP (index.html).
// In production nginx does the same split (nginx.conf).
const miniAppFallback = (): Plugin => ({
  name: "rombo-miniapp-fallback",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url ?? "").split("?")[0];
      if (path === "/app" || (path.startsWith("/app/") && !path.includes("."))) {
        req.url = "/miniapp.html" + (req.url!.includes("?") ? req.url!.slice(req.url!.indexOf("?")) : "");
      }
      next();
    });
  },
});

// Backend address for the dev proxy. Override in frontend/.env.local (gitignored) when the default port is
// taken, e.g. by another worktree: VITE_API_TARGET=127.0.0.1:8001
export default defineConfig(({ mode }) => {
  const api = loadEnv(mode, process.cwd(), "VITE_").VITE_API_TARGET || "127.0.0.1:8000";
  return {
    plugins: [react(), tailwindcss(), miniAppFallback()],
    resolve: { alias: { "@": "/src" } },
    build: {
      rollupOptions: { input: { main: "index.html", miniapp: "miniapp.html" } },
    },
    server: {
      port: 5173,
      // a dev tunnel (cloudflared / ngrok) for testing the Mini App inside Telegram sends its own Host
      allowedHosts: [".trycloudflare.com", ".ngrok-free.app", ".ngrok.app"],
      proxy: { "/api": `http://${api}`, "/ws": { target: `ws://${api}`, ws: true } },
    },
  };
});
