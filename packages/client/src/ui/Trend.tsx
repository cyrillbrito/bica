import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from './icons';

const TONE = {
  good: 'bg-running/12 text-running-ink',
  bad: 'bg-danger/12 text-danger-ink',
  neutral: 'bg-hover text-muted',
};

/**
 * A change with its direction on a small tinted tile, then its text
 * (affectUI's Change Summary): up and green for good, down and red for bad,
 * a dash for neutral. The arrow's shape carries it, not only the color.
 */
export function Trend(props: {
  tone: keyof typeof TONE;
  // Default: down for bad, up otherwise.
  down?: boolean;
  children: JSX.Element;
  class?: string;
}) {
  const down = () => props.down ?? props.tone === 'bad';
  return (
    <span
      class={[
        'inline-flex min-w-0 items-center gap-1.5 tabular-nums',
        props.class,
      ]}
    >
      <span
        class={[
          'grid size-5 shrink-0 place-items-center rounded-md [&_svg]:size-3 [&_svg]:stroke-[2.25]',
          TONE[props.tone],
        ]}
        aria-hidden="true"
      >
        <Show when={props.tone !== 'neutral'} fallback={<MinusIcon />}>
          {down() ? <ArrowDownIcon /> : <ArrowUpIcon />}
        </Show>
      </span>
      {props.children}
    </span>
  );
}
