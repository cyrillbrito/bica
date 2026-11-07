// `bun run dev` runs this next to Vite, one port above it: Vite serves the
// pages and forwards the socket and file links here (client/vite.config.ts).
import { serve } from './src/serve.ts';

const port = Number(process.env.BICA_PORT || 3142) + 1;
serve(port);
console.log(`Bica's server on port ${port}`);
