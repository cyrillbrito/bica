import { reducedMotion } from '../ui/motion';

/*
 * A queued prompt the agent takes glides from its line above the composer
 * to its place in the transcript, after affectUI's Agent Steering, so you
 * see which note went in. The queue row leaving and the prompt row arriving
 * happen in one update, in either order, so each side waits briefly for the
 * other, matched by text.
 */

const WAIT_MS = 1500;
const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';

type Left = { rect: DOMRect; at: number };
type Arrived = { el: HTMLElement; at: number };

const left = new Map<string, Left>();
const arrived = new Map<string, Arrived>();

function keyOf(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

// Every prompt row records itself on mount, a whole transcript at once.
function prune(map: Map<string, { at: number }>) {
  const old = Date.now() - WAIT_MS;
  for (const [key, v] of map) if (v.at < old) map.delete(key);
}

function fresh<T extends { at: number }>(map: Map<string, T>, key: string) {
  const hit = map.get(key);
  map.delete(key);
  return hit && Date.now() - hit.at < WAIT_MS ? hit : undefined;
}

function glide(el: HTMLElement, from: DOMRect) {
  if (reducedMotion()) return;
  // Laid out on the next frame: the prompt row is new.
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) + Math.abs(dy) < 4) return;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.5 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 200, easing: EASE },
    );
  });
}

/** A queue line is going away: where it was, in case the agent took it. */
export function queuedLeft(el: HTMLElement, text: string) {
  if (!el.isConnected || !text) return;
  const key = keyOf(text);
  const rect = el.getBoundingClientRect();
  const waiting = fresh(arrived, key);
  if (waiting) glide(waiting.el, rect);
  else {
    prune(left);
    left.set(key, { rect, at: Date.now() });
  }
}

/** A prompt row appeared: if its text just left the queue, it glides in. */
export function promptArrived(el: HTMLElement, text: string) {
  if (!text) return;
  const key = keyOf(text);
  const from = fresh(left, key);
  if (from) glide(el, from.rect);
  else {
    prune(arrived);
    arrived.set(key, { el, at: Date.now() });
  }
}
