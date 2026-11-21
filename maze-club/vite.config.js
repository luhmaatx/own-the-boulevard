import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/party': { target: 'ws://127.0.0.1:8787', ws: true },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 8192,
  },
});
