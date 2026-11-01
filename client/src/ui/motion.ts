import { untrack } from 'solid-js';

import { storageKey, stored } from './stored';

export type Motion = 'system' | 'full' | 'reduced';

// Lets the browser animate even when macOS has reduced motion on (most
// browsers can't override it themselves).
const KEY = 'motion';

const [motion, save] = stored<Motion>(KEY, 'system', [
  'system',
  'full',
  'reduced',
]);
export { motion };

export function setMotion(m: Motion) {
  save(m);
  if (m === 'system') delete document.documentElement.dataset.motion;
  else document.documentElement.dataset.motion = m;
}

/** For JS animations; CSS uses the `motion-safe` / `motion-reduce` variants. */
export function reducedMotion() {
  // Asked at the moment of animating, often in an effect's callback: a
  // one-time read, and Solid's dev warning for it costs ~100ms on a phone.
  const m = untrack(motion);
  if (m !== 'system') return m === 'reduced';
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Runs inline in <head> before first paint. */
export const motionBootScript = `try{var m=localStorage.getItem('${storageKey(KEY)}');if(m==='full'||m==='reduced')document.documentElement.dataset.motion=m}catch(e){}`;
