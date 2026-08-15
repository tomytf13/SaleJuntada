import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
