import type { JSX } from '@solidjs/web';

export type Tone =
  | 'accent'
  | 'running'
  | 'warn'
  | 'danger'
  | 'merged'
  | 'neutral';

const TONE: Record<Tone, string> = {
  accent: 'bg-accent/12 text-accent-ink',
  running: 'bg-running/12 text-running-ink',
  warn: 'bg-warn/15 text-warn-ink',
  danger: 'bg-danger/12 text-danger-ink',
  merged: 'bg-merged/12 text-merged-ink',
  neutral: 'bg-active text-fg/70',
};

/** The classes of a `Tag`, for a link or button that looks like one. */
export function tagClass(tone: Tone) {
  return `inline-flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-meta font-medium whitespace-nowrap [&_svg]:size-3.5 ${TONE[tone]}`;
}

/**
 * A calm tinted label for a state: Waiting, Failed, Running, Open #42. The
 * word carries the state, the tint only backs it up.
 */
export function Tag(props: {
  tone: Tone;
  class?: string;
  title?: string;
  children: JSX.Element;
}) {
  return (
    <span class={[tagClass(props.tone), props.class]} title={props.title}>
      {props.children}
    </span>
  );
}
