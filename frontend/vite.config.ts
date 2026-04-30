import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    allowedHosts: "all",
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/simulate': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8001',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },

  // ✅ THIS IS THE REAL FIX
  preview: {
    host: true,
    port: 3000,
    allowedHosts: ["ambient-ai-1.onrender.com"], // 👈 MUST MATCH EXACT DOMAIN
  },
});
