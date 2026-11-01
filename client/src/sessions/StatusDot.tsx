import { For, Show } from 'solid-js';

import type { SessionStatus } from '@bica/shared/protocol';
import { age, elapsed, formatDuration } from '../ui/time';
import { Tag, type Tone } from '../ui/Tag';

// Shape and color both carry the status.
const look: Record<SessionStatus, string> = {
  running:
    'rounded-full border-2 border-running border-r-transparent animate-spin',
  retrying:
    'rounded-full border-2 border-warn border-r-transparent animate-spin',
  error: 'bg-danger [clip-path:polygon(50%_0,100%_100%,0_100%)]',
  // A ring that breathes: the session holds until you answer; done is the
  // filled dot.
  waiting:
    'rounded-full border-[2.5px] border-accent motion-safe:animate-breathe',
  done: 'rounded-full bg-accent',
  idle: 'rounded-full border border-muted opacity-60',
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
            <span
              class={['size-2.5', look[status], pop && 'swap-in']}
              role="img"
              aria-label={STATUS[status].label}
              title={STATUS[status].label}
            />
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
