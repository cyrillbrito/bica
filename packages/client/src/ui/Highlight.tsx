import { reducedMotion } from './motion';

/**
 * A grey pill that glides from row to row under the pointer, after the
 * highlight of affectUI's Command Menu. Put `<Pill />` first inside a
 * positioned list whose rows are its offset children, and call `move(row)`
 * on pointer enter (or `move()` to hide). It lands without gliding when it
 * first shows, and with `glide: false` (keyboard moves stay instant).
 */
export function createHighlight() {
  let pill: HTMLSpanElement | undefined;
  let shown = false;

  const move = (row?: HTMLElement | null, glide = true) => {
    if (!pill) return;
    if (!row) {
      pill.style.opacity = '0';
      shown = false;
      return;
    }
    const instant = !shown || !glide || reducedMotion();
    if (instant) pill.style.transition = 'none';
    pill.style.translate = `0 ${row.offsetTop}px`;
    pill.style.height = `${row.offsetHeight}px`;
    pill.style.opacity = '1';
    if (instant) {
      void pill.offsetWidth;
      pill.style.transition = '';
    }
    shown = true;
  };

  const Pill = (props: { class?: string }) => (
    <span
      ref={(el) => (pill = el)}
      aria-hidden="true"
      class={[
        'pointer-events-none absolute top-0 opacity-0 transition-[translate,height] duration-200 ease-out',
        props.class ?? 'inset-x-1 rounded-md bg-hover',
      ]}
    />
  );

  return { Pill, move };
}
