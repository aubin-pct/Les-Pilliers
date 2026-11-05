/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import pkg from "./package.json" with { type: "json" };

// base "./" : l'appli marche à n'importe quelle adresse (GitHub Pages sert le dépôt dans un sous-dossier).
export default defineConfig({
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Les Piliers",
        short_name: "Piliers",
        description: "Corps, Capital, Esprit, Verbe. Quatre piliers qui s'effritent chaque jour, un Contremaître qui démonte tes excuses.",
        lang: "fr",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#101215",
        theme_color: "#101215",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
        runtimeCaching: [
          { urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com", handler: "StaleWhileRevalidate", options: { cacheName: "polices-css" } },
          { urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com", handler: "CacheFirst", options: { cacheName: "polices", expiration: { maxEntries: 20, maxAgeSeconds: 31536000 }, cacheableResponse: { statuses: [0, 200] } } },
        ],
      },
    }),
  ],
  test: { environment: "node", include: ["src/**/*.test.ts", "server/**/*.test.mjs"] },
});
