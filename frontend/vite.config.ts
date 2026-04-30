import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    host: true,
    allowedHosts: "all", // ✅ ADD THIS
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

  preview: {
    host: true,
    allowedHosts: "all", // ✅ IMPORTANT for Render
  },
});
