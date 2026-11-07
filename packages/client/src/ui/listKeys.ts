import { createSignal, flush } from 'solid-js';

/**
 * The highlighted row of a list that a search field drives, as the ARIA
 * combobox has it: focus stays in the field, ↑ and ↓ (or Ctrl-P and Ctrl-N)
 * move the highlight and wrap at the ends, and Enter picks it. Rows take
 * `optionId(i)` and `data-active` when `active() === i`; the field takes
 * `activeId()` as its `aria-activedescendant`.
 */
export function createActiveOption(props: {
  id: string;
  count: () => number;
  choose: (index: number, e: KeyboardEvent) => void;
}) {
  const [at, setAt] = createSignal(0, { name: 'activeOption' });
  // The list can shrink under the highlight, so it stops at the last row.
  const active = () => Math.min(at(), props.count() - 1);
  const optionId = (i: number) => `${props.id}-opt-${i}`;

  /** Highlights row `to` (wrapping) and scrolls it into view. */
  const move = (to: number) => {
    // A query set just before has to reach the list first.
    flush();
    const n = props.count();
    setAt(n ? ((to % n) + n) % n : 0);
    flush();
    document
      .getElementById(optionId(active()))
      ?.scrollIntoView({ block: 'nearest' });
  };

  return {
    active,
    optionId,
    move,
    /** Highlights the row under the pointer, which is in view already. */
    hover: (i: number) => setAt(i),
    /** Back to the first row, before the list exists. */
    reset: () => setAt(0),
    activeId: () => (props.count() ? optionId(active()) : undefined),
    /** The field's keys. Enter calls `choose` with the highlighted row. */
    onKeyDown(e: KeyboardEvent) {
      const step =
        e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')
          ? 1
          : e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')
            ? -1
            : 0;
      if (step) {
        e.preventDefault();
        move(active() + step);
      } else if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        if (props.count()) props.choose(active(), e);
      }
    },
  };
}

/**
 * Moves focus between `rows` that each take focus, as menus and tabs do: ↑
 * and ↓ (← and → when `horizontal`) step and wrap at the ends, Home and End
 * jump. Returns the row it moved to, or nothing for any other key.
 */
export function moveFocus(
  e: KeyboardEvent,
  rows: HTMLElement[],
  horizontal = false,
): HTMLElement | undefined {
  const [back, next] = horizontal
    ? ['ArrowLeft', 'ArrowRight']
    : ['ArrowUp', 'ArrowDown'];
  const n = rows.length;
  const at = rows.indexOf(document.activeElement as HTMLElement);
  const to =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? n - 1
        : e.key === next
          ? at + 1
          : e.key === back
            ? (at < 0 ? n : at) - 1
            : undefined;
  if (to === undefined || !n) return;
  e.preventDefault();
  const row = rows[(to + n) % n];
  row.focus();
  return row;
}
