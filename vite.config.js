import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The face. Talks to the deployed brain via API_BASE inside src/platform/api.js.
// `npm run dev`   -> local dev server (localhost:5173)
// `npm run build` -> static files in dist/ for deploying to Render/Vercel/Netlify
//
// CLARITY_API_TARGET (shell env or .env.local) moves the dev proxy when the
// engine is not on its usual port. The default is the documented one.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.CLARITY_API_TARGET || "http://127.0.0.1:8000";
  return {
    plugins: [react()],
    server: { port: 5173, open: false, proxy: { "/api": { target, changeOrigin: true } } },
  };
});
