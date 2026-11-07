import { Show } from 'solid-js';

import { Spinner } from '../ui/Spinner';
import { BrewingIcon, PouringIcon } from '../ui/icons';
import { createStopwatch, formatLive } from '../ui/time';
import { readError } from './error-message';

const CUPS = [BrewingIcon, PouringIcon];

// Written here, not by the model: they cost no tokens.
const PHRASES = [
  'Brewing',
  'Grinding the beans',
  'Tamping',
  'Pulling a shot',
  'Steaming the milk',
  'Frothing',
  'Warming the cups',
  'Dialing in the grind',
  'Pouring',
  'Blooming the grounds',
  'Stirring',
];

function pick<T>(list: T[]) {
  return list[Math.floor(Math.random() * list.length)]!;
}

/**
 * The agent is on it, from your prompt until the run ends: one line at the
 * bottom of the transcript, with the time since you sent it once that gets
 * long. Thinking and tool calls show above it as they happen, after Claude
 * Code and Codex, which keep one status line for the whole turn. Each run
 * gets a cup and a phrase picked at random. A failed attempt waiting to retry
 * says so, with the reason on hover.
 */
export default function Working(props: {
  since?: number;
  retry?: { at: number; error: string };
}) {
  const now = createStopwatch(() => true);
  const Cup = pick(CUPS);
  const phrase = pick(PHRASES);
  return (
    <div
      role="status"
      class="appear flex h-7 min-w-0 items-center gap-2 px-1.5 text-meta text-muted touch:h-11"
    >
      <Show
        when={props.retry}
        fallback={
          <>
            {/* Its weight is the cup, below the steam: centred, it reads low. */}
            <span class="flex -translate-y-px">
              <Cup />
            </span>
            <span class="shimmer text-ui font-medium">{phrase}</span>
            <Show
              when={props.since && formatLive(Math.max(0, now() - props.since))}
            >
              {(t) => <span class="tabular-nums">{t()}</span>}
            </Show>
          </>
        }
      >
        {(retry) => (
          <>
            <Spinner class="text-warn-ink" />
            <span class="text-ui font-medium text-warn-ink">Retrying</span>
            <span class="min-w-0 truncate" title={retry().error}>
              <span class="tabular-nums">
                {retry().at > now()
                  ? `in ${Math.ceil((retry().at - now()) / 1000)}s`
                  : 'now'}
              </span>
              {' · '}
              {readError(retry().error).message}
            </span>
          </>
        )}
      </Show>
    </div>
  );
}
