// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  output: "static",
  integrations: [react(), sitemap()],
  security: {
    // Enforces the PRD guarantee that no project data leaves the device.
    // Astro emits a per-page <meta http-equiv="content-security-policy"> and
    // supplies script-src / style-src itself ('self' plus a SHA-256 hash of
    // every island script, client chunk and stylesheet), so those two
    // directives must NOT be listed here — Astro rejects them.
    // Not applied under `astro dev`; test with `npm run build && npm run preview`.
    csp: {
      directives: [
        "default-src 'none'",
        // The load-bearing line: no fetch, XHR, WebSocket, sendBeacon or
        // EventSource is possible from the page. Loosening it must arrive as a
        // reviewed commit, never as a dashboard toggle.
        "connect-src 'none'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "manifest-src 'self'",
        "object-src 'none'",
        "worker-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
