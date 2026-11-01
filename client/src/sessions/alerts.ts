// What tells you a session moved while you look elsewhere: the app icon's
// badge and a chime. Both run once, in the sidebar.
import { createEffect, type Accessor } from 'solid-js';

import type { SessionStatus, SessionSummary } from '@bica/shared/protocol';
import { isBusy, needsYou } from '@bica/shared/status';
import { play, soundOn, type Chime } from '../ui/sound';

/** Keeps the icon's badge on the number of sessions that need you. */
export function useBadge(sessions: Accessor<SessionSummary[]>) {
  createEffect(
    () => sessions().filter((s) => !s.archivedAt && needsYou(s.status)).length,
    (count) => {
      if ('setAppBadge' in navigator)
        (count
          ? navigator.setAppBadge(count)
          : navigator.clearAppBadge()
        ).catch(() => {});
    },
    { name: 'appBadge' },
  );
}

function chimeFor(s: SessionStatus): Chime | undefined {
  if (s === 'waiting') return 'waiting';
  if (s === 'error') return 'error';
  // Idle too: a session you're looking at is marked read as it finishes.
  if (s === 'done' || s === 'idle') return 'done';
}

/** Chimes when a run ends: the most urgent sound of the batch. */
export function useChimes(sessions: Accessor<SessionSummary[]>) {
  let last = new Map<string, SessionStatus>();
  createEffect(
    () => ({
      on: soundOn(),
      list: sessions().map((s) => [s.id, s.status] as const),
    }),
    ({ on, list }) => {
      const prev = last;
      last = new Map(list);
      if (!on) return;
      let chime: Chime | undefined;
      for (const [id, status] of list) {
        if (!isBusy(prev.get(id)) || isBusy(status)) continue;
        const c = chimeFor(status);
        if (c === 'error' || (c === 'waiting' && chime !== 'error')) chime = c;
        else chime ??= c;
      }
      if (chime && firstTab(list)) play(chime);
    },
    { name: 'chimes' },
  );
}

// Every open tab sees the same change; the first to write the mark plays it.
function firstTab(list: readonly (readonly [string, SessionStatus])[]) {
  const mark = JSON.stringify(list);
  if (localStorage.getItem('bica.chimed') === mark) return false;
  localStorage.setItem('bica.chimed', mark);
  return true;
}
