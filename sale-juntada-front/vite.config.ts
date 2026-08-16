import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.svg",
        "pwa-icon.svg",
        "pwa-icon-maskable.svg",
        "pwa-icon-192.png",
        "pwa-icon-512.png",
        "pwa-icon-maskable-512.png",
      ],
      manifest: {
        id: "/",
        name: "Sale Juntada",
        short_name: "Sale Juntada",
        description:
          "Coordiná fechas, compras y gastos con tu grupo sin vueltas.",
        lang: "es-AR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#f7f5ef",
        theme_color: "#0c79d8",
        categories: ["social", "lifestyle", "utilities"],
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/pwa-icon-maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("maplibre-gl")) return "maps";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("socket.io") || id.includes("engine.io"))
            return "realtime";
          if (id.includes("@tanstack")) return "query";
          if (id.includes("date-fns")) return "dates";
          if (
            id.includes("react/") ||
            id.includes("react-dom") ||
            id.includes("react-router")
          )
            return "react";
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
