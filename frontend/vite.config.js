import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // Required by some Stellar SDK internals that reference global
    global: "globalThis",
  },
  build: {
    // Suppress the large-chunk warning (Stellar SDK is inherently large)
    chunkSizeWarningLimit: 1600,
  },
});
