import { getSharedHighlighter, type DiffsHighlighter } from '@pierre/diffs';
import { useNavigate } from '@solidjs/router';
import type {
  InlineNode,
  InlineParseResult,
  MarkdownExtension,
} from '@tanstack/markdown';
import { streamingMarkdownExtension } from '@tanstack/markdown/extensions/streaming';
import { renderHtml } from '@tanstack/markdown/html';
import { parseMarkdown } from '@tanstack/markdown/parser';
import {
  For,
  Loading,
  Show,
  createMemo,
  createSignal,
  onSettled,
  untrack,
} from 'solid-js';

import { CopyButton } from '../ui/CopyButton';

import { openPath, showPath } from '../files/files';

import Mermaid from './Mermaid';
import { createSmoothText } from './smooth-text';
import { CODE_THEME } from '../files/pierre';

// Pierre's shared Shiki instance, the same one the diff and file views use.
const LANGS = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'bash',
  'python',
  'go',
  'rust',
  'css',
  'html',
  'sql',
  'yaml',
  'toml',
  'diff',
  'markdown',
];

const [shiki, setShiki] = createSignal<DiffsHighlighter | undefined>(
  undefined,
  {
    name: 'shiki',
  },
);
// Bumped when a language loads, so replies using it re-render.
const [langsLoaded, setLangsLoaded] = createSignal(0, { name: 'shikiLangs' });
const requested = new Set<string>();

void getSharedHighlighter({
  themes: [CODE_THEME.light, CODE_THEME.dark],
  langs: LANGS,
}).then((h) => setShiki(() => h));

function loadLang(lang: string) {
  if (requested.has(lang)) return;
  requested.add(lang);
  getSharedHighlighter({
    themes: [CODE_THEME.light, CODE_THEME.dark],
    langs: [lang],
  }).then(
    () => setLangsLoaded((n) => n + 1),
    () => {}, // Not a language Shiki knows: stays plain.
  );
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Every update re-renders every block, so finished code blocks come from here.
const cache = new Map<string, string>();

// Reads the signals, so the markdown memo re-runs once Shiki or a language is ready.
function highlight(code: string, lang?: string) {
  const h = shiki();
  if (!h || !lang || lang === 'plaintext' || lang === 'text')
    return escape(code);
  if (!h.hasLoadedLanguages([lang])) {
    langsLoaded();
    loadLang(lang);
    return escape(code);
  }
  const key = `${lang}\0${code}`;
  let html = cache.get(key);
  if (html === undefined) {
    // Only the spans: TanStack supplies <pre><code>.
    html = h
      .codeToHtml(code, {
        lang,
        themes: CODE_THEME,
        defaultColor: 'light-dark()',
      })
      .replace(/^<pre[^>]*><code[^>]*>/, '')
      .replace(/<\/code><\/pre>$/, '');
    if (cache.size > 500) cache.clear();
    cache.set(key, html);
  }
  return html;
}

// TanStack has no GFM autolinks: link bare `https://…` / `www.…` and `<https://…>`.
const ANGLE = /^<(https?:\/\/[^\s<>]+)>/;
const BARE = /^(?:https?:\/\/|www\.)[^\s<]+/;
function link(href: string, text: string, length: number): InlineParseResult {
  return {
    node: { type: 'link', href, children: [{ type: 'text', value: text }] },
    length,
  };
}
// Same trailing trim as GFM: punctuation, and a `)` with no opener.
function trimUrl(url: string): string {
  const trimmed = url.replace(/[?!.,:;*_~'"]+$/, '');
  const unbalanced =
    trimmed.endsWith(')') &&
    trimmed.split(')').length > trimmed.split('(').length;
  const next = unbalanced ? trimmed.slice(0, -1) : trimmed;
  return next === url ? url : trimUrl(next);
}
const autolinks: MarkdownExtension = {
  name: 'autolinks',
  inlineParser: {
    markers: '<hw',
    parse({ source, index, inLink }) {
      if (inLink) return;
      const rest = source.slice(index);
      const angle = ANGLE.exec(rest);
      if (angle?.[1]) return link(angle[1], angle[1], angle[0].length);
      if (/\w/.test(source[index - 1] ?? '')) return;
      const bare = BARE.exec(rest)?.[0];
      if (!bare) return;
      const url = trimUrl(bare);
      if (url === 'www.' || /^https?:\/\/$/.test(url)) return;
      const href = url.startsWith('www.') ? `https://${url}` : url;
      return link(href, url, url.length);
    },
  },
};

// Paths open in Bica, or with a modifier on the dev machine (files.ts).
const PATH = 'bica-path:';
const LINE = /(?::\d+){0,2}$/;
const EXTENSIONS = new Set(
  'md mdx txt json jsonl ts tsx js jsx mjs cjs css html py go rs sh sql yaml yml toml lock env log csv xml svg png jpg jpeg gif pdf'.split(
    ' ',
  ),
);
// Code spans: `~/x`, `./x`, `/a/b`, `src/x.ts`, `src/`, or `REPORT.md`, with
// an optional `:line:column`. Not `solid-js/web` or `args.path`.
function isPath(code: string): boolean {
  const name = code.replace(LINE, '');
  if (!/^[\w.~@+/-]+$/.test(name) || /^[-@]/.test(name)) return false;
  if (/^(?:~|\.\.?)\//.test(name) || /^\w[\w.-]*\/$/.test(name)) return true;
  const parts = name.split('/').filter(Boolean);
  if (name.startsWith('/')) return parts.length >= 2;
  if (parts.length > 1)
    return name.endsWith('/') || /\.\w+$/.test(parts.at(-1)!);
  return EXTENSIONS.has(name.split('.').at(-1)!) && name.includes('.');
}
// Bare text only links unmistakable paths: `~/…`, `./…`, and `/a/b/c`.
const BARE_PATH = /^(?:~|\.\.?)?\/[\w.@+-]+(?:\/[\w.@+-]+)*\/?(?::\d+){0,2}/;
const pathlinks: MarkdownExtension = {
  name: 'pathlinks',
  inlineParser: {
    markers: '~./',
    parse({ source, index, inLink }) {
      if (inLink || /[\w/.~]/.test(source[index - 1] ?? '')) return;
      const found = BARE_PATH.exec(source.slice(index))?.[0];
      if (!found) return;
      const path = found.replace(/[.,:;]+$/, '');
      if (path.startsWith('/') && path.split('/').filter(Boolean).length < 3)
        return;
      return link(PATH + path, path, path.length);
    },
  },
};
type Node = { type: string; value?: string; children?: Node[] };
function linkCodePaths(node: Node): void {
  if (node.type === 'link' || !node.children) return;
  node.children = node.children.map((child) => {
    if (child.type === 'inlineCode' && isPath(child.value!)) {
      const linked: InlineNode = {
        type: 'link',
        href: PATH + child.value!,
        children: [child as InlineNode],
      };
      return linked;
    }
    linkCodePaths(child);
    return child;
  });
}

// Model output is untrusted: TanStack escapes raw HTML and drops unsafe URLs.
// Heading ids would change as a streamed heading grows.
const options = {
  extensions: [streamingMarkdownExtension(), autolinks, pathlinks],
  frontmatter: false,
  headingIds: false,
};

/**
 * Re-parses the whole text on every update (it's fast), then renders each
 * top-level block separately: a block whose HTML didn't change keeps its
 * DOM, so while streaming only the last block is replaced.
 */
export default function Markdown(props: {
  text: string;
  // Where relative paths start.
  cwd?: string;
  // A reply that may still grow: added text types in. Read once.
  streaming?: boolean;
}) {
  const navigate = useNavigate();
  const streaming = untrack(() => props.streaming);
  const smooth = streaming ? createSmoothText(() => props.text) : undefined;
  const blocks = createMemo(
    () => {
      const text = smooth ? smooth.text() : props.text;
      const nodes = parseMarkdown(text, options).children;
      return nodes.map((node, i) => {
        // A diagram renders once its fence closes, not on every streamed line.
        const closed =
          i < nodes.length - 1 || /\n(```|~~~)\s*$/.test(text.trimEnd());
        if (node.type === 'code' && node.lang === 'mermaid' && closed)
          return { key: `${i}:mermaid:${node.value}`, mermaid: node.value };
        linkCodePaths(node);
        const html = renderHtml(
          { type: 'root', children: [node] },
          { highlighter: highlight },
        );
        return { key: `${i}:${html}`, html };
      });
    },
    { name: 'markdownBlocks' },
  );
  // A block that starts after the first paint fades in, unless it came with
  // a catch-up; the last block re-rendering as it grows isn't new.
  let ready = false;
  let newest = -1;
  onSettled(() => {
    ready = true;
  });
  // The code block under the pointer gets a copy button in its corner.
  const [code, setCode] = createSignal<HTMLPreElement | undefined>(undefined, {
    name: 'hoveredCode',
  });
  return (
    <div
      class="markdown relative"
      onPointerOver={(event) => {
        const pre = (event.target as Element).closest('pre');
        if (pre && pre !== code()) setCode(pre);
      }}
      onPointerLeave={() => setCode(undefined)}
      onClick={(event) => {
        // Links leave the app in a new tab. Paths open in Bica, with ⌘ in
        // the editor, and with Alt in Finder.
        const link = (event.target as Element).closest('a');
        if (!link?.href) return;
        event.preventDefault();
        const href = link.getAttribute('href') ?? '';
        const path = href.startsWith(PATH) && href.slice(PATH.length);
        if (path && (event.metaKey || event.ctrlKey || event.altKey))
          void openPath(path, props.cwd, event.altKey);
        else if (path) void showPath(path, props.cwd, navigate);
        else window.open(link.href, '_blank', 'noopener');
      }}
    >
      <For each={blocks()} keyed={(b) => b.key}>
        {(block, i) => {
          const n = untrack(i);
          const fresh = smooth && ready && n > newest && !smooth.jumped();
          newest = Math.max(newest, n);
          const diagram = untrack(block).mermaid;
          if (diagram !== undefined)
            return (
              <Loading>
                <Mermaid text={diagram} class="my-3" />
              </Loading>
            );
          return (
            <div
              class={fresh ? 'stream-in' : 'contents'}
              // Safe: renderHtml escapes raw HTML, and Shiki escapes code.
              // eslint-disable-next-line solid/no-innerhtml
              innerHTML={block().html}
            />
          );
        }}
      </For>
      <Show when={code()?.isConnected && code()}>
        {(pre) => (
          <div
            class="absolute"
            style={{
              top: `${pre().offsetTop + 6}px`,
              left: `${pre().offsetLeft + pre().offsetWidth - 34}px`,
            }}
          >
            <CopyButton
              title="Copy code"
              text={() => pre().textContent ?? ''}
              class="bg-panel text-muted"
            />
          </div>
        )}
      </Show>
    </div>
  );
}
