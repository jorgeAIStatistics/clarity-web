import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The face. Talks to the deployed brain via API_BASE inside src/Clarity.jsx.
// `npm run dev`   -> local dev server (localhost:5173)
// `npm run build` -> static files in dist/ for deploying to Render/Vercel/Netlify
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
