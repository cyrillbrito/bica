import { createEffect, createMemo, onSettled, untrack } from 'solid-js';

import { theme as appTheme } from '../ui/theme';
import { artifactMode, artifactTheme, pageUrl } from './artifacts';

/**
 * One artifact full size, in the same sandbox as HTML files: an opaque
 * origin with no reach into Bica. The page loads the kit itself; this only
 * tells it the picked theme and light or dark, and reloads it, at the same
 * scroll, when the file changes.
 */
export default function ArtifactViewer(props: {
  name: string;
  title: string;
  updated: number;
}) {
  let frame: HTMLIFrameElement | undefined;
  let scroll = 0;

  // `bica` follows Bica's own appearance, which may be forced in Settings.
  const mode = () => (artifactMode() === 'bica' ? appTheme() : artifactMode());

  // Only a new version reloads; a new theme goes by message.
  const src = createMemo(
    () => {
      const v = String(props.updated);
      return untrack(() =>
        pageUrl(props.name, {
          theme: artifactTheme(),
          mode: mode(),
          v,
          ...(scroll && { scroll: String(Math.round(scroll)) }),
        }),
      );
    },
    { name: 'artifactSrc' },
  );

  const picks = () => ({ theme: artifactTheme(), mode: mode() });
  const send = (p: { theme: string; mode: string }) =>
    frame?.contentWindow?.postMessage(
      { type: 'bica-kit:theme', ...p },
      // The sandboxed page has an opaque origin, which no other value names.
      '*',
    );

  createEffect(picks, send, { defer: true, name: 'artifactThemeSend' });

  onSettled(() => {
    const listen = (event: MessageEvent) => {
      if (event.source !== frame?.contentWindow) return;
      const data = event.data as { type?: string; y?: unknown } | null;
      if (data?.type === 'bica-kit:scroll' && typeof data.y === 'number')
        scroll = data.y;
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  });

  return (
    <iframe
      ref={(el) => (frame = el)}
      src={src()}
      title={props.title}
      // A pick made while it loaded would otherwise be lost.
      onLoad={() => send(untrack(picks))}
      class="block min-h-0 w-full flex-1 border-0 bg-paper"
    />
  );
}
