import type { ParentProps } from 'solid-js';

import { motionBootScript } from './ui/motion';
import { themeBootScript } from './ui/theme';

// The page in place of index.html, picked up by the src/Document.* convention.
// The build renders it once into dist/client/index.html; the app renders into
// its <body> in the browser.
export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#fcfaf6"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#1c1c20"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="color-scheme" content="light dark" />
        {/* SomaFM refuses streams to a localhost referrer, see docs/voice.md. */}
        <meta name="referrer" content="no-referrer" />
        {/* oxlint-disable-next-line solid/no-innerhtml -- a constant of ours, no user input */}
        <script innerHTML={themeBootScript + motionBootScript} />
        <title>Bica</title>
      </head>
      <body>{props.children}</body>
    </html>
  );
}
