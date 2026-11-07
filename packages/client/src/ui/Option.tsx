import type { JSX } from '@solidjs/web';

import { createHighlight } from './Highlight';

/**
 * A row in a menu, picker, or dialog list: 32px, 44px on touch. Inside an
 * `OptionList` the hover fill glides to it; keyboard focus, or `data-active`
 * in a list a search field drives, fills the row itself.
 */
export const optionClass =
  'relative flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:bg-active data-active:bg-active disabled:pointer-events-none disabled:opacity-40 touch:min-h-11';

const INSET = {
  1: ['p-1', 'inset-x-1 rounded-lg bg-hover'],
  2: ['p-2', 'inset-x-2 rounded-lg bg-hover'],
} as const;

/**
 * A scrolling list of options whose hover fill glides from row to row
 * (`createHighlight`). Rows are its buttons, links, and labels, at any depth,
 * so group labels in between stay out of it. `inset` is the padding around
 * the rows: 1 in a popover, 2 in a dialog.
 */
export function OptionList(props: {
  children: JSX.Element;
  inset?: 1 | 2;
  ref?: (el: HTMLElement) => void;
  role?: 'listbox' | 'group';
  label?: string;
  id?: string;
  class?: string;
}) {
  const highlight = createHighlight();
  const inset = () => INSET[props.inset ?? 1];
  return (
    <div
      ref={props.ref}
      id={props.id}
      role={props.role}
      aria-label={props.label}
      class={[
        // `*:shrink-0`: a truncated label has no minimum height, so in a
        // full list it would be squeezed to nothing.
        'relative flex min-h-0 flex-col overflow-y-auto overscroll-contain *:shrink-0',
        inset()[0],
        props.class,
      ]}
      onPointerOver={(e) => {
        const row = (e.target as Element).closest<HTMLElement>(
          'button, a, label, [role="option"]',
        );
        highlight.move(
          row && e.currentTarget.contains(row) && !row.matches(':disabled')
            ? row
            : null,
        );
      }}
      onPointerLeave={() => highlight.move()}
    >
      <highlight.Pill class={inset()[1]} />
      {props.children}
    </div>
  );
}

/** The quiet label over a group of options. */
export function OptionGroup(props: { children: JSX.Element }) {
  return (
    <div class="truncate px-2.5 pt-2 pb-1 text-meta text-muted">
      {props.children}
    </div>
  );
}

/** What a list of options says when a search leaves nothing. */
export function NoMatches(props: { children?: JSX.Element }) {
  return (
    <p class="px-2.5 py-3 text-meta text-muted">
      {props.children ?? 'Nothing matches'}
    </p>
  );
}
