import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Plain client-side Solid: index.html loads src/main.tsx, and `/app` falls
// back to the same page (Vite's SPA fallback), which picks the screen by path.
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: { port: 3190, strictPort: true },
  build: { target: 'esnext' },
});
