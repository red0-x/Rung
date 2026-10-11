import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Config lives in the repo-root .env (shared with the server). Only the public
// Supabase URL + anon key (public by design) and the optional API base reach the
// browser. Nothing else from .env is exposed: no service-role key, no Dial secrets.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  const apiBase = env.VITE_API_BASE || '';

  return {
    plugins: [react()],
    envDir: false,
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_API_BASE': JSON.stringify(apiBase),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:8787', changeOrigin: true },
      },
    },
  };
});
