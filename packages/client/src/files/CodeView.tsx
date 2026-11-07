import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
  untrack,
} from 'solid-js';

import type { GitChange, WorkspaceRef } from '@bica/shared/protocol';
import { readBlobs, readDiff, type Side } from '../git/git';
import { readFile, type View } from './files';
import { FILE_OPTIONS, diffOptions } from './pierre';
import FilePreview, { previewKind, type PreviewKind } from './FilePreview';
import { errorText } from '../ui/errors';

type Diffs = typeof import('@pierre/diffs');
type Instance = InstanceType<Diffs['File']> | InstanceType<Diffs['FileDiff']>;

/** Why a side can't be shown as text, or nothing when it can. */
function problem(t: Side) {
  return t.text === null && t.reason !== 'missing' && t.reason !== 'media'
    ? `File is ${t.reason}`
    : '';
}

type Media = { label: string; mimeType: string; url: string };

function toMedia(t: Side, label: string): Media[] {
  if (t.text !== null || t.reason !== 'media') return [];
  // A new URL each time: showMedia revokes the last ones, even for the
  // same data when only split, wrap, or preview changed.
  const blob =
    'blob' in t
      ? t.blob
      : new Blob([Uint8Array.from(atob(t.data), (c) => c.charCodeAt(0))], {
          type: t.mimeType,
        });
  return [{ label, mimeType: t.mimeType, url: URL.createObjectURL(blob) }];
}

// Pierre's scrollbars sit under the last line, out of reach in a long file.
// CodeView shows one pinned to the bottom of the view instead.
const SCROLLBAR_CSS = `
[data-code] { scrollbar-width: none; }
[data-code]::-webkit-scrollbar { display: none; }
`;

type Place = { top: number; left: number };
// Where each file and diff was left, for the tab's lifetime.
const leftAt = new Map<string, Place>();
// What the user does to scroll, as opposed to the content changing size.
const INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * One file or one diff, rendered by Pierre. Re-reads whenever `version`
 * changes; the old render stays on screen until the new one is ready.
 */
export default function CodeView(props: {
  workspace: WorkspaceRef;
  path: string;
  view: View;
  oldPath?: string;
  // The submodule the change is in; absent, the workspace's own repo.
  repo?: string;
  version?: string;
  // A diff's blob hashes from status, read over HTTP; absent: `git.diff`.
  blobs?: GitChange['blobs'];
  split: boolean;
  // Long lines wrap instead of scrolling sideways.
  wrap: boolean;
  // Markdown, HTML, and Mermaid files show rendered instead of as code.
  preview: boolean;
}) {
  let host: HTMLDivElement | undefined;
  let scroller!: HTMLDivElement;
  let bar!: HTMLDivElement;
  let spacer!: HTMLDivElement;
  let instance: Instance | undefined;
  let kind: 'file' | 'diff' | undefined;
  // What is shown, and the place to return to, held while it renders and
  // highlights until the user scrolls themselves.
  let shown = '';
  let held: Place | undefined;
  const release = () => (held = undefined);
  const remember = () => {
    if (shown && !held)
      leftAt.set(shown, { top: scroller.scrollTop, left: bar.scrollLeft });
  };
  const [note, setNote] = createSignal('');
  const [rendered, setRendered] = createSignal<
    { kind: PreviewKind; text: string } | undefined
  >(undefined, { name: 'codeViewPreview' });
  // Images, PDFs, audio, and video, shown in place of Pierre.
  const [media, setMedia] = createSignal<Media[]>([]);
  const showMedia = (next: Media[]) => {
    for (const m of untrack(media)) URL.revokeObjectURL(m.url);
    setMedia(next);
  };

  // Pierre's horizontal scrollers: one, or two in split view.
  const codes = () => [
    ...(host
      ?.querySelector('diffs-container')
      ?.shadowRoot?.querySelectorAll<HTMLElement>('[data-code]') ?? []),
  ];
  // The bar and the code columns follow whichever one the user scrolled.
  // Pierre's own split sync is off (see onPostRender): two syncs fought.
  const range = (c: HTMLElement) => c.scrollWidth - c.clientWidth;
  const measure = () => {
    const max = Math.max(0, ...codes().map(range));
    bar.hidden = max <= 0;
    spacer.style.width = `${bar.clientWidth + max}px`;
    if (held) {
      bar.scrollLeft = held.left;
      scroller.scrollTop = held.top;
    }
    // The bar holds the position: Pierre reuses its scrollers across files.
    follow(bar.scrollLeft);
  };
  // Scroll events land a frame late. The ones our own writes cause must be
  // skipped, or a stale position pulls everything back.
  const echo = new WeakMap<Element, number>();
  const follow = (x: number, source?: Element) => {
    for (const el of [bar, ...codes()]) {
      if (el === source || el.scrollLeft === x) continue;
      el.scrollLeft = x;
      echo.set(el, el.scrollLeft);
    }
  };
  const onScroll = (e: Event) => {
    const el = e.target as HTMLElement;
    if (el !== bar && !el.matches?.('[data-code]')) return;
    if (echo.get(el) === el.scrollLeft) return void echo.delete(el);
    echo.delete(el);
    follow(el.scrollLeft, el);
    remember();
  };
  const watched = new WeakSet<ShadowRoot>();
  // Also runs after highlighting lands, which can change line widths.
  const onPostRender = (container: HTMLElement, diff: object) => {
    // Off: it raced with follow() and made the columns jump.
    (
      diff as { scrollSyncManager?: { cleanUp(): void } }
    ).scrollSyncManager?.cleanUp();
    const root = container.shadowRoot;
    if (root && !watched.has(root)) {
      watched.add(root);
      root.addEventListener('scroll', onScroll, {
        capture: true,
        passive: true,
      });
    }
    measure();
  };

  const drop = () => {
    instance?.cleanUp();
    instance = undefined;
    host?.replaceChildren();
    if (bar) bar.hidden = true;
  };
  // Made on first use: the content's growth re-applies a held place.
  let resize: ResizeObserver | undefined;
  const observe = (el: HTMLElement) =>
    (resize ??= new ResizeObserver(measure)).observe(el);
  onSettled(() => {
    observe(scroller);
    observe(host!);
    for (const type of INPUT)
      scroller.addEventListener(type, release, { passive: true });
    return () => {
      resize?.disconnect();
      drop();
      showMedia([]);
    };
  });

  // Loaded on first use: Shiki is heavy and the server never needs it.
  const loaded = createMemo(
    async () => {
      const { workspace: ref, path, view, oldPath, repo } = props;
      // A new version is a reason to read again.
      void props.version;
      const blobs = view === 'file' ? undefined : props.blobs;
      const [diffs, data] = await Promise.all([
        import('@pierre/diffs'),
        view === 'file'
          ? readFile(ref, path)
          : blobs
            ? readBlobs(ref, path, blobs, view === 'changes', oldPath, repo)
            : readDiff(ref, path, view === 'staged', oldPath, repo),
      ]);
      return { diffs, data, path, view, oldPath, ref };
    },
    { name: 'codeViewData' },
  );

  // A re-read of the same file (an agent editing it) keeps the position.
  createEffect(
    () => ({
      k: loaded(),
      split: props.split,
      wrap: props.wrap,
      preview: props.preview,
    }),
    {
      effect: ({ k, split, wrap, preview }) => {
        setRendered(undefined);
        const overflow = wrap ? ('wrap' as const) : ('scroll' as const);
        const { diffs, data } = k;
        const place = [k.ref.projectId, k.ref.cwd, k.view, k.path].join('\n');
        if (shown !== place) {
          shown = place;
          held = leftAt.get(place) ?? { top: 0, left: 0 };
          bar.scrollLeft = held.left;
          scroller.scrollTop = held.top;
        }
        const want = k.view === 'file' ? 'file' : 'diff';
        if (kind !== want) drop();
        kind = want;
        const found =
          'old' in data
            ? [...toMedia(data.old, 'Before'), ...toMedia(data.new, 'After')]
            : toMedia(data, '');
        showMedia(found);
        if (found.length) {
          drop();
          setNote('');
          return;
        }
        if ('old' in data) {
          const why = problem(data.old) || problem(data.new);
          if (why) {
            drop();
            setNote(why);
            return;
          }
          const oldText = data.old.text ?? '';
          const newText = data.new.text ?? '';
          // Whitespace is left out of the diff (parseDiffOptions).
          const trimmed = (t: string) =>
            t
              .split('\n')
              .map((l) => l.trim())
              .join('\n');
          setNote(
            oldText === newText
              ? 'No changes'
              : trimmed(oldText) === trimmed(newText)
                ? 'Only whitespace changed'
                : '',
          );
          const options = {
            ...diffOptions(k.path, scroller.clientWidth, split),
            overflow,
            unsafeCSS: SCROLLBAR_CSS,
            onPostRender,
          };
          const diff = (instance ??= new diffs.FileDiff(
            options,
          )) as InstanceType<Diffs['FileDiff']>;
          diff.setOptions(options);
          diff.render({
            oldFile: { name: k.oldPath ?? k.path, contents: oldText },
            newFile: { name: k.path, contents: newText },
            containerWrapper: host!,
            forceRender: true,
          });
        } else {
          if (data.text === null) {
            drop();
            setNote(
              data.reason === 'missing' ? 'File not found' : problem(data),
            );
            return;
          }
          setNote('');
          const kind = preview && previewKind(k.path);
          if (kind) {
            drop();
            setRendered({ kind, text: data.text });
            return;
          }
          const options = {
            ...FILE_OPTIONS,
            overflow,
            unsafeCSS: SCROLLBAR_CSS,
            onPostRender,
          };
          const file = (instance ??= new diffs.File(options)) as InstanceType<
            Diffs['File']
          >;
          file.setOptions(options);
          file.render({
            file: { name: k.path, contents: data.text },
            containerWrapper: host!,
            forceRender: true,
          });
        }
      },
      // A failed read is a note in place, not an error for the whole page.
      error: (error) => {
        drop();
        setRendered(undefined);
        showMedia([]);
        setNote(errorText(error));
      },
    },
  );

  return (
    <div
      ref={(el) => (scroller = el)}
      class="relative min-h-0 flex-1 overflow-auto overscroll-contain"
      onScroll={remember}
    >
      <div ref={(el) => (host = el)} class="code-view" />
      <div
        ref={(el) => (bar = el)}
        hidden
        class="code-scrollbar sticky bottom-0 overflow-x-auto overflow-y-hidden bg-bg"
        onScroll={onScroll}
      >
        <div ref={(el) => (spacer = el)} class="h-px" />
      </div>
      {/* In the view's own scroller, so its place is kept too; a page
          fills the view and scrolls inside its frame. */}
      <Show when={rendered()}>
        {(r) => (
          <div
            ref={observe}
            class={r().kind === 'html' ? 'absolute inset-0' : undefined}
          >
            <FilePreview kind={r().kind} text={r().text} path={props.path} />
          </div>
        )}
      </Show>
      <Show when={media().length}>
        <div class="flex min-h-full flex-wrap items-start justify-center gap-6 p-6">
          <For each={media()}>
            {(m) => (
              <figure
                class={[
                  'flex min-w-0 flex-col items-center gap-2',
                  {
                    'h-[80dvh] w-full max-w-4xl flex-1':
                      m.mimeType === 'application/pdf',
                  },
                ]}
              >
                <Show when={m.label}>
                  <figcaption class="text-meta text-muted">
                    {m.label}
                  </figcaption>
                </Show>
                <Switch>
                  <Match when={m.mimeType.startsWith('image/')}>
                    <img
                      src={m.url}
                      alt={props.path}
                      class="max-w-full rounded-card border border-line bg-well"
                    />
                  </Match>
                  <Match when={m.mimeType.startsWith('video/')}>
                    <video
                      src={m.url}
                      controls
                      class="max-w-full rounded-card"
                    />
                  </Match>
                  <Match when={m.mimeType.startsWith('audio/')}>
                    <audio src={m.url} controls />
                  </Match>
                  <Match when={m.mimeType === 'application/pdf'}>
                    <iframe
                      src={m.url}
                      title={props.path}
                      class="w-full flex-1 rounded-card border border-line"
                    />
                  </Match>
                </Switch>
              </figure>
            )}
          </For>
        </div>
      </Show>
      <Show when={note()}>
        <p class="absolute inset-x-0 top-0 p-6 text-center text-muted">
          {note()}
        </p>
      </Show>
    </div>
  );
}
