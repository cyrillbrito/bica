import { fileRoutes } from 'filesystem-routing/vite';
import { defineConfig, type Plugin } from 'vite';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import compression from 'compression';

// Own ports so other projects never collide (live is 3141, see
// server/cli/bica.ts); fail instead of hopping so the tailscale serve mapping
// stays right. The server runs one port up (server/dev.ts).
const port = Number(process.env.BICA_PORT || 3142);

// The phone loads the dev server over a slow link (docs/deploy.md), and Vite
// dev sends everything uncompressed. Added before Vite's own middlewares.
function compress(): Plugin {
  return {
    name: 'bica:compress',
    configureServer(server) {
      const gzip = compression();
      // Its types expect Express requests; Vite passes plain Node ones.
      server.middlewares.use((req, res, next) =>
        gzip(req as never, res as never, next),
      );
    },
  };
}

export default defineConfig({
  // No index.html or entry files: the plugin generates them around
  // src/App.tsx, wrapped in src/Document.tsx. `vite build` emits dist/client,
  // which the server serves in production (server/cli/bica.ts).
  plugins: [
    solid({
      start: true,
      // Dev-only: capture control at /__solid/diagnostics (see docs/UI.md).
      diagnostics: true,
      // On by default in dev, they record every component and effect run and
      // made drawing a long session about 3x slower, which the phone feels.
      // Turn back on briefly to read a trace in Chrome's Performance panel.
      performanceTracks: false,
      // Also compile the `?pick=` route modules fileRoutes emits.
      extensions: ['.jsx', '.tsx'],
    }),
    fileRoutes({ types: true }),
    tailwindcss(),
    compress(),
  ],
  server: {
    port,
    strictPort: true,
    // Reached from the phone through `tailscale serve` (docs/deploy.md).
    allowedHosts: ['.ts.net'],
    proxy: {
      '/ws': { target: `ws://127.0.0.1:${port + 1}`, ws: true },
      // Files over HTTP (server/src/git/download.ts).
      '/download/': `http://127.0.0.1:${port + 1}`,
      '/blob/': `http://127.0.0.1:${port + 1}`,
      '/attachment/': `http://127.0.0.1:${port + 1}`,
    },
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 0,
  },
});
