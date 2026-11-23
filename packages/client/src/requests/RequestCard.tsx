import type { JSX } from '@solidjs/web';
import { Show, createEffect, createSignal, onSettled, untrack } from 'solid-js';

import { reducedMotion } from '../ui/motion';
import Chevron from '../ui/Chevron';
import { CheckIcon, CloseIcon, DrawnCheckIcon } from '../ui/icons';

/*
 * The frame every request card shares (docs/requests.md), after affectUI's
 * Approval Card: while the session waits, a card on a tray with a header,
 * a sheet, and a footer of actions; once answered, the card glides down
 * into one row that opens to what was asked and answered.
 */

export function RequestTray(props: {
  open: boolean;
  label: string;
  busy?: boolean;
  danger?: boolean;
  // `seen`: answered while on screen, so the row animates in.
  resolved: (seen: boolean) => JSX.Element;
  children: JSX.Element;
}) {
  // Answered while on screen: the tray holds its height for a frame, then
  // glides down to the resolved row. Loaded answered, it is just the row.
  const [settled, setSettled] = createSignal(
    untrack(() => !props.open),
    { name: 'requestSettled' },
  );
  let root!: HTMLDivElement;
  let lastHeight = 0;
  onSettled(() => {
    const ro = new ResizeObserver(() => {
      if (props.open) lastHeight = root.offsetHeight;
    });
    ro.observe(root);
    return () => ro.disconnect();
  });
  createEffect(
    () => props.open,
    (open, was) => {
      if (open || !was || reducedMotion() || !lastHeight) return;
      setSettled(false);
      const to = root.scrollHeight;
      root.style.height = `${lastHeight}px`;
      void root.offsetHeight;
      root.style.height = `${to}px`;
      const done = () => {
        root.style.height = '';
        setSettled(true);
      };
      const id = setTimeout(done, 450);
      return () => clearTimeout(id);
    },
  );
  return (
    <div
      ref={(el) => (root = el)}
      role="group"
      aria-label={props.label}
      class={[
        'appear overflow-hidden rounded-tray p-1 motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-out',
        props.open && props.danger
          ? 'border border-danger/30 bg-danger/8'
          : 'bg-well',
        props.open && props.busy && 'cursor-progress',
      ]}
    >
      <Show when={props.open} fallback={props.resolved(!settled())}>
        {props.children}
      </Show>
    </div>
  );
}

export function RequestHeader(props: {
  icon: JSX.Element;
  title: JSX.Element;
  danger?: boolean;
  children?: JSX.Element;
}) {
  return (
    <div
      class={[
        'flex h-8 items-center gap-1.5 px-2.5 text-meta',
        props.danger ? 'text-danger-ink' : 'text-muted',
      ]}
    >
      {props.icon}
      <span class={['font-medium', !props.danger && 'text-fg']}>
        {props.title}
      </span>
      {props.children}
    </div>
  );
}

export function RequestSheet(props: {
  danger?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <div
      class={[
        'flex flex-col rounded-sheet border bg-surface p-3 md:p-4',
        props.danger ? 'border-danger/30' : 'border-line',
        props.class,
      ]}
    >
      {props.children}
    </div>
  );
}

export function RequestFooter(props: { children: JSX.Element }) {
  return (
    <div class="flex min-h-11 flex-wrap items-center justify-end gap-x-3 gap-y-1 py-1 pr-0.5 pl-2.5">
      {props.children}
    </div>
  );
}

/**
 * The answered card as one row that opens to the details. `done` draws a
 * check, `declined` a cross, and `closed`, for one nobody answered, neither.
 */
export function ResolvedRow(props: {
  seen: boolean;
  outcome: 'done' | 'declined' | 'closed';
  summary: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <details class="group/resolved expand">
      <summary
        class={[
          'flex min-h-10 cursor-pointer list-none items-center gap-2.5 rounded-sheet border border-line bg-surface px-3 py-2 transition-colors hover:border-line-strong [&::-webkit-details-marker]:hidden',
          props.seen && 'appear',
        ]}
      >
        <Show when={props.outcome !== 'closed'}>
          <span
            class={[
              'grid size-5 shrink-0 place-items-center rounded-full [&_svg]:size-3 [&_svg]:stroke-[2.5]',
              props.outcome === 'done'
                ? 'bg-running/15 text-running'
                : 'bg-active text-muted',
              props.seen && 'swap-in',
            ]}
          >
            <Show when={props.outcome === 'done'} fallback={<CloseIcon />}>
              <Show when={props.seen} fallback={<CheckIcon />}>
                <DrawnCheckIcon />
              </Show>
            </Show>
          </span>
        </Show>
        <span class="min-w-0 flex-1 truncate">{props.summary}</span>
        <Chevron class="text-muted group-open/resolved:rotate-90" />
      </summary>
      <div class="flex flex-col gap-3 px-3 pt-3 pb-2">{props.children}</div>
    </details>
  );
}
