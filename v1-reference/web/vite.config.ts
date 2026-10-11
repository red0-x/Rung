import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, /api is proxied to the backend so the dashboard needs no CORS or env setup.
// In production on Vercel, set VITE_API_BASE to the backend's public URL.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  build: { outDir: 'dist' },
});
