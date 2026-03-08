import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev proxy: /api/prices → local dev-prices-server.mjs (port 8788)
 * which mirrors the Cloudflare Pages Function.
 *
 * To use in dev:
 *   Terminal 1: node dev-prices-server.mjs
 *   Terminal 2: npm run dev
 */
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      '/api/prices': {
        target:      'http://localhost:8788',
        changeOrigin: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts:   ['recharts'],
          query:    ['@tanstack/react-query'],
        },
      },
    },
  },
})
