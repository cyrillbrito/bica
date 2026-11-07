import { Show } from 'solid-js';

import { DrawnCheckIcon } from './icons';

/**
 * The box of a checkbox, or the dot of a radio, inside a row that carries
 * the role and `group/opt`. When picked, the check draws in.
 */
export function CheckMark(props: { on: boolean; radio?: boolean }) {
  return (
    <span
      aria-hidden="true"
      class={[
        'grid size-4 shrink-0 place-items-center border transition-colors duration-150 [&_svg]:size-3 [&_svg]:stroke-3',
        props.radio ? 'rounded-full' : 'rounded-sm',
        props.on
          ? 'border-accent bg-accent text-bg'
          : 'border-line-strong group-hover/opt:border-muted',
      ]}
    >
      <Show when={props.on}>
        <Show
          when={!props.radio}
          fallback={<span class="swap-in size-1.5 rounded-full bg-bg" />}
        >
          <DrawnCheckIcon />
        </Show>
      </Show>
    </span>
  );
}
