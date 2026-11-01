import { For, Show } from 'solid-js';

import type { SessionStatus } from '@bica/shared/protocol';
import { age, elapsed, formatDuration } from '../ui/time';
import { Tag, type Tone } from '../ui/Tag';

/**
 * One family, after Linear's issue status icons: every state is the same
 * ring, and shape as well as color tells them apart. The spin is progress, so
 * it stays under reduced motion; the waiting halo is decoration.
 */
function shape(status: SessionStatus) {
  const ring = (extra?: { fill?: boolean; arc?: boolean }) => (
    <circle
      cx="5"
      cy="5"
      r="4.25"
      stroke="currentColor"
      stroke-width="1.5"
      fill={extra?.fill ? 'currentColor' : 'none'}
      pathLength={extra?.arc ? 1 : undefined}
      stroke-dasharray={extra?.arc ? '0.7 0.3' : undefined}
    />
  );
  switch (status) {
    case 'running':
    case 'retrying':
      return ring({ arc: true });
    case 'done':
      return ring({ fill: true });
    // A dot in the ring tells it from idle when the halo is off.
    case 'waiting':
      return (
        <>
          {ring()}
          <circle cx="5" cy="5" r="1.5" fill="currentColor" />
        </>
      );
    case 'error':
      return (
        <>
          {ring()}
          <path
            d="M3.6 3.6l2.8 2.8m0-2.8l-2.8 2.8"
            stroke="currentColor"
            stroke-width="1.25"
            stroke-linecap="round"
          />
        </>
      );
    default:
      return ring();
  }
}

const look: Record<SessionStatus, string> = {
  running: 'text-running animate-spin',
  retrying: 'text-warn animate-spin',
  error: 'text-danger',
  // The session holds until you answer.
  waiting: 'rounded-full text-accent motion-safe:animate-breathe',
  done: 'text-accent',
  idle: 'text-muted opacity-60',
};

/**
 * How each status reads (docs/GLOSSARY.md: Status): in full, as one word,
 * and the tint of the ones that ask for something.
 */
export const STATUS: Record<
  SessionStatus,
  {
    label: string;
    word: string;
    tone?: Extract<Tone, 'accent' | 'warn' | 'danger'>;
  }
> = {
  running: { label: 'Running', word: 'Running' },
  retrying: {
    label: 'Retrying after a provider error',
    word: 'Retrying',
    tone: 'warn',
  },
  error: { label: 'Failed', word: 'Failed', tone: 'danger' },
  waiting: { label: 'Waiting for you', word: 'Waiting', tone: 'accent' },
  done: { label: 'Unread', word: 'Unread' },
  idle: { label: 'Idle', word: '' },
};

/**
 * Even size: the rows are an even height, so the dot lands on whole pixels
 * (an odd size centers at .5px and blurs). A change you see pops the new
 * shape in, after affectUI's Agent Inbox; going idle doesn't, since opening
 * an unread session does that and switching sessions stays still.
 */
export default function StatusDot(props: { status: SessionStatus }) {
  let seen = false;
  return (
    <span class="grid size-2.5 shrink-0 place-items-center">
      <For each={[props.status]}>
        {(status) => {
          const pop = seen && status !== 'idle';
          seen = true;
          return (
            <svg
              viewBox="0 0 10 10"
              class={['size-2.5', look[status], pop && 'swap-in']}
              role="img"
              aria-label={STATUS[status].label}
            >
              <title>{STATUS[status].label}</title>
              {shape(status)}
            </svg>
          );
        }}
      </For>
    </span>
  );
}

/**
 * The right end of a session row, after affectUI's Agent Inbox: a live clock
 * while it runs, a tinted tag when it waits on you or failed, else how long
 * ago it last moved. A change crossfades in place.
 */
export function StatusTag(props: {
  status: SessionStatus;
  // When the current run started, for the clock.
  since?: number | null;
  updatedAt: number;
}) {
  const kind = (): SessionStatus | 'clock' | 'age' =>
    props.status === 'running' && props.since
      ? 'clock'
      : STATUS[props.status].tone
        ? props.status
        : 'age';
  let seen = false;
  return (
    <span class="grid shrink-0 justify-items-end">
      <For each={[kind()]}>
        {(k) => {
          const fade = seen;
          seen = true;
          const tag = k === 'clock' || k === 'age' ? undefined : STATUS[k];
          return (
            <Show
              when={tag?.tone && tag}
              fallback={
                <span
                  class={[
                    'text-meta tabular-nums',
                    k === 'clock' ? 'text-running-ink' : 'text-muted',
                    fade && 'appear',
                  ]}
                  title={k === 'clock' ? 'Running for' : undefined}
                >
                  {k === 'clock'
                    ? formatDuration(elapsed(props.since!))
                    : age(props.updatedAt)}
                </span>
              }
            >
              {(tag) => (
                <Tag tone={tag().tone!} class={fade ? 'appear' : undefined}>
                  {tag().word}
                </Tag>
              )}
            </Show>
          );
        }}
      </For>
    </span>
  );
}
