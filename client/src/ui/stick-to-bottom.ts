import { createEffect, onSettled, type Accessor } from 'solid-js';

// Within this of the end counts as "at the bottom" (fractional zoom offsets).
const SLACK = 4;
// The glide's spring, per 60 fps frame: use-stick-to-bottom's defaults.
const DAMPING = 0.7;
const STIFFNESS = 0.05;
const MASS = 1.25;
const FRAME_MS = 1000 / 60;

// Where each transcript was left, for the tab's lifetime. Absent is at the
// end. Measured from the top, so messages that land meanwhile don't move it.
const leftAt = new Map<string, number>();
// What the user does to scroll, as opposed to the content changing size.
const INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * Keeps a scroll container pinned to its end while the user is there, and
 * leaves it alone once they scroll up. Size changes, not data, drive it:
 * streamed text, late code highlighting, images loading, and the composer
 * growing all move the end. A fresh container starts at the bottom, before
 * the first paint (ResizeObserver runs between layout and paint).
 *
 * `key` names what is shown. Coming back to a key puts the view where it
 * was left: at the end, following, or at the same place.
 */
export function createStickToBottom(key: Accessor<string>) {
  let scroller: HTMLElement | undefined;
  let following = true;
  let lastTop = 0;
  let shown: string | undefined;
  // A place to return to, held while the content loads and grows until the
  // user scrolls themselves.
  let held: number | undefined;
  const hold = () => {
    if (held === undefined || !scroller) return;
    scroller.scrollTop = held;
    lastTop = scroller.scrollTop;
  };
  const release = () => (held = undefined);
  const remember = () => {
    if (shown === undefined || !scroller) return;
    if (following) leftAt.delete(shown);
    else leftAt.set(shown, scroller.scrollTop);
  };
  // Opening a tool call or thinking block is the user's own doing: the
  // view stays put rather than jumping to the end.
  let toggling = false;

  const distance = (el: HTMLElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight;

  let frame: number | undefined;
  let lastFrame = 0;
  let velocity = 0;
  // Movement too small for the browser to apply yet, as it rounds scrollTop.
  let carry = 0;

  const pin = () => {
    if (!scroller) return;
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    velocity = carry = 0;
    scroller.scrollTop = scroller.scrollHeight;
    lastTop = scroller.scrollTop;
  };

  // A streamed line jumping the view up by its height reads as a jolt; the
  // view springs to the end instead. Its speed carries from line to line, so
  // a steady stream scrolls as one motion. Kept under reduced motion: it
  // moves the page less than the jumps it replaces.
  const step = (now: number) => {
    frame = undefined;
    const el = scroller;
    const left = el && following ? distance(el) : 0;
    if (!el || left <= 1) {
      velocity = carry = 0;
      return;
    }
    const ticks = Math.min(now - lastFrame, 100) / FRAME_MS;
    lastFrame = now;
    velocity = (DAMPING * velocity + STIFFNESS * left) / MASS;
    carry += velocity * ticks;
    const before = el.scrollTop;
    el.scrollTop = before + carry;
    if (el.scrollTop !== before) carry = 0;
    lastTop = el.scrollTop;
    frame = requestAnimationFrame(step);
  };
  const glide = () => {
    if (frame !== undefined) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(step);
  };

  const onScroll = () => {
    const el = scroller!;
    if (held !== undefined) return;
    if (distance(el) <= SLACK) following = true;
    else if (el.scrollTop < lastTop) following = false;
    lastTop = el.scrollTop;
    remember();
  };

  const onClick = (e: MouseEvent) => {
    if (!(e.target as Element).closest('summary')) return;
    toggling = true;
    // Normally used up by the resize it causes; this covers a toggle that
    // changes no size. (Not rAF: that runs before ResizeObserver.)
    setTimeout(() => (toggling = false), 100);
  };

  const onResize = () => {
    if (held !== undefined) return hold();
    if (toggling && scroller) {
      toggling = false;
      following = distance(scroller) <= SLACK;
      return;
    }
    if (!following || !scroller) return;
    // Big changes, such as a session opening, land at once.
    if (distance(scroller) > scroller.clientHeight / 2) pin();
    else glide();
  };
  // Made on first use: refs only run in the browser, the hook may not.
  let observer: ResizeObserver | undefined;
  const observe = (el: HTMLElement) =>
    (observer ??= new ResizeObserver(onResize)).observe(el);
  onSettled(() => () => {
    observer?.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
  });

  const follow = () => {
    release();
    following = true;
    pin();
    remember();
  };
  createEffect(
    key,
    (k) => {
      shown = k;
      const top = leftAt.get(k);
      if (top === undefined) return follow();
      following = false;
      held = top;
      hold();
    },
    { name: 'stickShown' },
  );

  return {
    scroller: (el: HTMLElement) => {
      scroller = el;
      el.addEventListener('scroll', onScroll, { passive: true });
      el.addEventListener('click', onClick, true);
      for (const type of INPUT)
        el.addEventListener(type, release, { passive: true });
      observe(el);
    },
    /** Its content, whose growth moves the end. */
    content: (el: HTMLElement) => {
      observe(el);
    },
    /** Back to following, e.g. after sending. */
    follow,
  };
}
