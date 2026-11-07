import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import d2 from 'astro-d2';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import d2Shared from './d2-shared.mjs';

export default defineConfig({
  site: 'https://bica.sh',
  // Next to Bica's own ports (client/vite.config.ts), clear of Astro's 4321
  // that other projects use.
  server: { port: 3144 },
  vite: {
    // Demos mount real client components in the browser (src/demos/).
    // @astrojs/solid-js only supports Solid 1, so Solid 2's own plugin
    // compiles them.
    plugins: [solid(), tailwindcss()],
    resolve: {
      alias: { '@client': new URL('../client/src', import.meta.url).pathname },
    },
    // Bun's isolated install hides satteri's native package from the bundled
    // prerender chunks, so load it from node_modules instead.
    ssr: { external: ['satteri'] },
    server: { allowedHosts: ['.ts.net'] },
  },
  integrations: [
    // D2.js renders in JavaScript, so no D2 binary has to be installed.
    d2({
      experimental: { useD2js: true },
      layout: 'elk',
      pad: 40,
      inline: true,
    }),
    d2Shared(),
    starlight({
      title: 'Bica',
      logo: { src: './public/favicon.svg' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/d2.css'],
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/cyrillbrito/bica',
        },
      ],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What is Bica', slug: 'docs' },
            'docs/start/install',
            'docs/start/first-run',
            'docs/start/how-it-works',
            'docs/start/phone',
            'docs/start/faq',
          ],
        },
        {
          label: 'Basics',
          items: [
            'docs/basics/layout',
            'docs/basics/sessions',
            'docs/basics/composer',
            'docs/basics/projects',
            'docs/basics/files',
            'docs/basics/git',
            'docs/basics/terminals',
            'docs/basics/command-palette',
          ],
        },
        {
          label: 'Features',
          items: [
            'docs/features/tools',
            'docs/features/instructions',
            'docs/features/context',
            'docs/features/orchestration',
            'docs/features/night-runs',
            'docs/features/assistant-mode',
            'docs/features/hub',
            'docs/features/voice',
          ],
        },
        {
          label: 'Set up',
          items: [{ autogenerate: { directory: 'docs/setup' } }],
        },
        {
          label: 'Reference',
          items: [{ autogenerate: { directory: 'docs/reference' } }],
        },
      ],
    }),
  ],
});
