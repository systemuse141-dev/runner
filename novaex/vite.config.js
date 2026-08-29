import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web app is built into server/public so the API process can serve it
// from a single origin (cookies + websocket stay same-origin).
export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
      '/ws': { target: 'ws://127.0.0.1:3000', ws: true },
    },
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
