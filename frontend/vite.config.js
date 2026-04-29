import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // === MODULE CHATBOT (POC, retirable) ===
  // dedupe : force Vite à résoudre ces paquets depuis un seul node_modules,
  // sinon les fichiers ../chatbot/frontend/*.jsx peuvent embarquer une copie
  // distincte de React et provoquer "Invalid hook call".
  resolve: {
    dedupe: ["react", "react-dom", "react-router", "lucide-react"],
  },
  // === FIN MODULE CHATBOT ===
  server: {
    // === MODULE CHATBOT (POC, retirable) ===
    // Autorise Vite à servir les fichiers du dossier ../chatbot (module externe).
    fs: { allow: [".."] },
    // === FIN MODULE CHATBOT ===
    proxy: {
      "/api": {
        target: "http://localhost:3010",
        changeOrigin: true,
      },
    },
  },
});