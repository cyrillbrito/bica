// Port of BoardUI's tooltip/tooltip.tsx (MIT). React Aria's TooltipTrigger
// and OverlayArrow became a manual popover shown on hover and focus, placed
// above the trigger (below when there's no room), with the same caret.
import type { JSX } from '@solidjs/web';
import { Show, createSignal, createUniqueId, onSettled } from 'solid-js';

import { cx } from './cx';

const CARETS = {
  top: { width: 12, height: 7, path: 'M0 0 L6 6 L12 0', shadow: '0 1.5px 1px' },
  bottom: {
    width: 12,
    height: 7,
    path: 'M0 7 L6 1 L12 7',
    shadow: '0 -1.5px 1px',
  },
};

export function Tooltip(props: {
  content: JSX.Element;
  size?: 'sm' | 'md';
  showArrow?: boolean;
  class?: string;
  children: JSX.Element;
}) {
  const id = createUniqueId();
  const [side, setSide] = createSignal<'top' | 'bottom'>('top');
  let anchor!: HTMLSpanElement;
  let tip!: HTMLDivElement;
  const offset = 10;

  const show = () => {
    if (tip.matches(':popover-open')) return;
    tip.showPopover();
    const t = anchor.getBoundingClientRect();
    const p = { width: tip.offsetWidth, height: tip.offsetHeight };
    const top = t.top - offset - p.height;
    const below = top < 8;
    setSide(below ? 'bottom' : 'top');
    tip.style.top = `${below ? t.bottom + offset : top}px`;
    tip.style.left = `${Math.max(8, Math.min(t.left + t.width / 2 - p.width / 2, innerWidth - p.width - 8))}px`;
    tip.style.setProperty(
      '--caret-x',
      `${t.left + t.width / 2 - parseFloat(tip.style.left)}px`,
    );
  };
  const hide = () => tip.hidePopover();

  onSettled(() => {
    anchor
      .querySelector('button, a, input, [tabindex]')
      ?.setAttribute('aria-describedby', id);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <span
      ref={anchor}
      class={cx('inline-flex', props.class)}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusIn={(e) =>
        (e.target as HTMLElement).matches(':focus-visible') && show()
      }
      onFocusOut={hide}
    >
      {props.children}
      <div
        ref={tip}
        id={id}
        popover="manual"
        role="tooltip"
        class={cx(
          'bui-tooltip pointer-events-none m-0 max-w-[240px] overflow-visible select-none rounded-lg border border-border-button-default bg-background-primary-default text-text-primary shadow-dropdown',
          props.size === 'md'
            ? 'rounded-2lg px-3 py-2 text-body-medium'
            : 'px-2.5 py-1.5 text-caption-1-medium',
          side() === 'top' ? 'origin-bottom' : 'origin-top',
        )}
      >
        <Show when={props.showArrow ?? true}>
          <svg
            width={CARETS[side()].width}
            height={CARETS[side()].height}
            viewBox={`0 0 ${CARETS[side()].width} ${CARETS[side()].height}`}
            class={cx(
              'absolute block -translate-x-1/2 overflow-visible fill-background-primary-default stroke-border-button-default',
              side() === 'top' ? 'top-full -mt-px' : 'bottom-full -mb-px',
            )}
            style={{
              left: 'var(--caret-x, 50%)',
              filter: `drop-shadow(${CARETS[side()].shadow} rgb(0 0 0 / 0.05))`,
            }}
          >
            <path d={CARETS[side()].path} />
          </svg>
        </Show>
        {props.content}
      </div>
    </span>
  );
}
