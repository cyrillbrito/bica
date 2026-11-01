import { createEffect, onSettled } from 'solid-js';

import { diffOptions } from './pierre';

type Diffs = typeof import('@pierre/diffs');

export type DiffSource =
  | { name: string; patch: string }
  | { name: string; old: string; new: string };

/**
 * A small inline diff, rendered by Pierre, side by side when asked and there's
 * room. It has no header because the caller shows the path. Its height is
 * capped on desktop only: on a phone a scroller inside the page's scroller is
 * awkward to thumb.
 */
export default function DiffBlock(props: {
  source: DiffSource;
  split?: boolean;
}) {
  let host: HTMLDivElement | undefined;
  let instance: InstanceType<Diffs['FileDiff']> | undefined;
  // The transcript hands over a new object on every update, so only redraw
  // when the text changed.
  let shown = '';
  onSettled(() => () => instance?.cleanUp());

  createEffect(
    () => ({ source: props.source, split: props.split }),
    ({ source, split }) => {
      const key = JSON.stringify([source, split]);
      if (key === shown) return;
      let stale = false;
      // Loaded on first use: Shiki is heavy and most rows are never opened.
      void import('@pierre/diffs').then((diffs) => {
        if (stale || !host) return;
        shown = key;
        const options = {
          ...diffOptions(source.name, host.clientWidth, !!split),
          // Wrapped, not scrolled: a hidden scrollbar hides the line's end.
          overflow: 'wrap' as const,
        };
        instance ??= new diffs.FileDiff(options);
        instance.setOptions(options);
        if ('patch' in source) {
          const fileDiff = diffs.processFile(source.patch);
          if (fileDiff)
            instance.render({
              fileDiff,
              containerWrapper: host,
              forceRender: true,
            });
        } else {
          instance.render({
            oldFile: { name: source.name, contents: source.old },
            newFile: { name: source.name, contents: source.new },
            containerWrapper: host,
            forceRender: true,
          });
        }
      });
      return () => (stale = true);
    },
  );

  return (
    // A hairline frame, so the diff's own darker ground reads as one block
    // inside the activity card.
    <div class="overflow-hidden rounded-md border border-line md:max-h-[28rem] md:overflow-auto md:overscroll-contain">
      <div ref={(el) => (host = el)} class="code-view" />
    </div>
  );
}
