import type { JSX } from '@solidjs/web';
import {
  For,
  Show,
  createEffect,
  createSignal,
  onSettled,
  untrack,
} from 'solid-js';

import { Spinner } from './Spinner';

/**
 * "The agent is working": the spinner and a shimmering label, laid out by the
 * parent (`display: contents`). A new label rolls in as the old one rolls
 * out, and the box glides to its width. When done, the spinner gives way to
 * a check (or `doneIcon`) and the label to `doneLabel`. After affectUI's
 * Thinking Loader. No live region of its own: a transcript holds many, and
 * the row around it carries the name.
 */
export function ThinkingLoader(props: {
  /** What it's doing now. Changing it rolls the new text in. */
  label: string;
  done?: boolean;
  doneLabel?: string;
  /** Shown instead of the check once done, e.g. the step's own icon. */
  doneIcon?: JSX.Element;
  /** Off when the label already has a fixed width (`labelClass`). */
  fit?: boolean;
  labelClass?: string;
}) {
  const text = () => (props.done ? (props.doneLabel ?? 'Done') : props.label);

  // The label on screen plus the one rolling out. The first one just shows.
  let n = 0;
  const [labels, setLabels] = createSignal([
    { key: 0, text: untrack(text), out: false },
  ]);
  createEffect(text, (t, prev) => {
    if (prev === undefined || t === prev) return;
    setLabels((ls) => [
      ...ls.filter((l) => !l.out).map((l) => ({ ...l, out: true })),
      { key: ++n, text: t, out: false },
    ]);
  });
  const drop = (key: number) =>
    setLabels((ls) => ls.filter((l) => l.key !== key));

  // Done from the start (a reload): the check is just there, not drawn.
  const doneAtStart = untrack(() => !!props.done);

  let box: HTMLSpanElement;
  onSettled(() => {
    if (props.fit === false) return;
    const fit = () => {
      const cur = box.querySelector<HTMLElement>(':scope > [data-current]');
      if (cur) box.style.width = `${cur.offsetWidth + 1}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    const mo = new MutationObserver(() => {
      ro.disconnect();
      for (const el of box.children) ro.observe(el);
      fit();
    });
    for (const el of box.children) ro.observe(el);
    mo.observe(box, { childList: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  });

  return (
    <span class="contents" data-done={props.done ? '' : undefined}>
      <span class="relative size-4 shrink-0" aria-hidden="true">
        <Spinner
          class={[
            'absolute inset-0 size-full transition-[opacity,scale,rotate] duration-200 ease-out',
            props.done && 'scale-60 -rotate-45 opacity-0',
          ]}
        />
        <Show when={props.done}>
          <Show
            when={props.doneIcon}
            fallback={
              <svg
                viewBox="0 0 16 16"
                class="absolute inset-0 size-full fill-none stroke-current text-fg"
              >
                <path
                  d="M3.5 8.4 6.6 11.3 12.5 4.9"
                  pathLength="1"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class={doneAtStart ? undefined : 'draw'}
                />
              </svg>
            }
          >
            <span
              class={[
                'absolute inset-0 grid place-items-center',
                !doneAtStart && 'swap-in',
              ]}
            >
              {props.doneIcon}
            </span>
          </Show>
        </Show>
      </span>
      <span
        ref={(el) => (box = el)}
        class={[
          'relative block h-5 overflow-hidden whitespace-nowrap',
          props.fit !== false && 'morph',
          props.labelClass,
        ]}
      >
        <For each={labels()} keyed={(l) => l.key}>
          {(l) => (
            <span
              data-current={l().out ? undefined : ''}
              aria-hidden={l().out ? 'true' : undefined}
              class={l().out ? 'roll-out' : l().key > 0 && 'roll-in'}
              onAnimationEnd={(e) =>
                l().out && e.target === e.currentTarget && drop(l().key)
              }
            >
              {/* Its own layer: the shimmer is an animation too. */}
              <span class={!l().out && !props.done ? 'shimmer' : undefined}>
                {l().text}
              </span>
            </span>
          )}
        </For>
      </span>
    </span>
  );
}
