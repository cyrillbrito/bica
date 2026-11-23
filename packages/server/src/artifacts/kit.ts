import type { BunRequest } from 'bun';
import { compile } from 'tailwindcss';
import tailwindIndex from 'tailwindcss/index.css' with { type: 'text' };
import tailwindBrowser from '@tailwindcss/browser' with { type: 'file' };
import echartsFile from 'echarts/dist/echarts.min.js' with { type: 'file' };

import base from './kit/base.css' with { type: 'text' };
import fontFaces from './kit/fonts.css' with { type: 'text' };
import { FONTS } from './kit/fonts';
import runtime from './kit/runtime.js' with { type: 'text' };
import tailwindTheme from './kit/tailwind.css' with { type: 'text' };
import { THEMES } from './kit/themes';

// The artifact kit (docs/artifacts.md): one script a page includes to get the
// themes, Tailwind, and ECharts, all served by Bica so pages work offline and
// show what they depend on. The viewer only displays the page.

export const KIT_URL = '/artifact-kit/kit.js';

/** The include line, however the agent quoted or spaced it. */
const KIT_SCRIPT =
  /<script\b[^>]*\bsrc\s*=\s*["']?\/artifact-kit\/kit\.js["']?[^>]*>\s*<\/script>/i;

export type Mode = 'light' | 'dark' | 'system';

interface Config {
  themes: string[];
  mode: Mode;
  css: string;
  tailwind: string | null;
}

/** The runtime called with `config`, in place of its last line's placeholder. */
function runtimeWith(config: Config) {
  const at = runtime.lastIndexOf('KIT_CONFIG');
  return `${runtime.slice(0, at)}${JSON.stringify(config)}${runtime.slice(at + 'KIT_CONFIG'.length)}`;
}

let kit: Promise<{ body: Uint8Array; gzip: Uint8Array; etag: string }>;

// ECharts first, so the runtime can wrap `echarts.init`, and Tailwind last,
// so it finds the theme the runtime adds. One script, loaded in <head>
// before the page's own scripts run, so they can draw charts at once.
async function buildKit() {
  const [echarts, tailwind] = await Promise.all([
    Bun.file(echartsFile).text(),
    Bun.file(tailwindBrowser).text(),
  ]);
  const config: Config = {
    themes: THEMES.map((t) => t.id),
    mode: 'system',
    css: [fontFaces, base, ...THEMES.map((t) => t.css)].join('\n'),
    tailwind: tailwindTheme,
  };
  const body = new TextEncoder().encode(
    [echarts, runtimeWith(config), tailwind].join('\n;\n'),
  );
  return {
    body,
    gzip: Bun.gzipSync(body),
    etag: `"${Bun.hash(body).toString(36)}"`,
  };
}

// The page runs on an opaque origin (a sandbox without allow-same-origin),
// and fonts load in CORS mode, so the kit's files allow any origin. They
// hold nothing private.
const OPEN = { 'Access-Control-Allow-Origin': '*' };

export async function serveKit(req: Request) {
  const { body, gzip, etag } = await (kit ??= buildKit());
  // Revalidated on each load, so a new kit reaches open pages at once.
  const headers = {
    ...OPEN,
    'Content-Type': 'text/javascript; charset=utf-8',
    'Cache-Control': 'no-cache',
    ETag: etag,
  };
  if (req.headers.get('if-none-match') === etag)
    return new Response(null, { status: 304, headers });
  const zipped = /\bgzip\b/.test(req.headers.get('accept-encoding') ?? '');
  return new Response(zipped ? gzip : body, {
    headers: { ...headers, ...(zipped && { 'Content-Encoding': 'gzip' }) },
  });
}

export function serveFont(req: BunRequest<'/artifact-kit/fonts/:file'>) {
  const path = Object.hasOwn(FONTS, req.params.file)
    ? FONTS[req.params.file]
    : undefined;
  if (!path) return new Response(null, { status: 404 });
  return new Response(Bun.file(path), {
    headers: {
      ...OPEN,
      'Content-Type': 'font/woff2',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * One self-contained file: the kit's include swapped for inline code with
 * one theme, its fonts, ECharts when the page draws charts, and only the
 * Tailwind classes the page uses, compiled. It runs offline, anywhere. A
 * page without the include comes back as it is.
 */
export async function exportPage(html: string, themeId: string, mode: Mode) {
  if (!KIT_SCRIPT.test(html)) return html;
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0]!;
  const [fonts, tailwind, echarts] = await Promise.all([
    inlineFonts(theme.css),
    compileTailwind(html),
    /\becharts\b/.test(html.replace(KIT_SCRIPT, ''))
      ? Bun.file(echartsFile).text()
      : '',
  ]);
  const config: Config = {
    themes: [theme.id],
    mode,
    css: [fonts, base, theme.css, tailwind].join('\n'),
    tailwind: null,
  };
  const code = [echarts, runtimeWith(config)].filter(Boolean).join('\n;\n');
  return html.replace(
    KIT_SCRIPT,
    () => `<script>\n${inlineScript(code)}\n</script>`,
  );
}

/**
 * Tailwind's compiler, the one its browser build runs, given every word of
 * the page as a candidate: it keeps the ones that are classes and drops the
 * rest, so classes a script adds count too. A fresh compiler each time,
 * since one keeps every class it was ever given.
 */
async function compileTailwind(html: string) {
  const compiler = await compile(`@import "tailwindcss";\n${tailwindTheme}`, {
    base: '/',
    loadStylesheet: async (id, base) => {
      if (id !== 'tailwindcss') throw new Error(`Can't load ${id}`);
      return { path: 'tailwindcss/index.css', base, content: tailwindIndex };
    },
  });
  return compiler.build([...new Set(html.split(/[\s"'`<>=]+/))]);
}

/** The faces the theme names, as data URIs. */
async function inlineFonts(themeCss: string) {
  const faces = fontFaces.match(/@font-face\s*{[^}]*}/g) ?? [];
  const used = faces.filter((face) => {
    const family = /font-family:\s*'([^']+)'/.exec(face)?.[1];
    return family && themeCss.includes(`'${family}'`);
  });
  const inlined = await Promise.all(
    used.map(async (face) => {
      const file = /\/artifact-kit\/fonts\/([^')]+)/.exec(face)?.[1];
      const path = file && Object.hasOwn(FONTS, file) && FONTS[file];
      if (!path) return '';
      const data = Buffer.from(await Bun.file(path).arrayBuffer());
      return face.replace(
        /url\('[^']+'\)/,
        () => `url(data:font/woff2;base64,${data.toString('base64')})`,
      );
    }),
  );
  return inlined.join('\n');
}

/**
 * Code safe inside an inline <script>: no early `</script>`, and no `<!--`,
 * which changes how the HTML parser reads what follows. Both only appear
 * inside strings and regexes, where `\/` and `\x21` mean the same.
 */
function inlineScript(code: string) {
  return code
    .replace(/<\/script/gi, (m) => `<\\/${m.slice(2)}`)
    .replace(/<!--/g, '<\\x21--');
}
