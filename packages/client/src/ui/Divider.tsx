import { Show } from 'solid-js';
import Chevron from './Chevron';

/**
 * A collapsible list's heading drawn as a rule: label, count, a hairline, and
 * the chevron at the line's end. Goes inside a `<summary>` or a button; pass
 * `open`, or inside `<details>` a `group-open/*` rotation as `chevron`.
 */
export default function Divider(props: {
  label: string;
  count?: number;
  open?: boolean;
  chevron?: string;
}) {
  return (
    <>
      <span class="truncate">{props.label}</span>
      <Show when={props.count !== undefined}>
        <span class="font-normal tabular-nums opacity-70">
          {props.count?.toLocaleString()}
        </span>
      </Show>
      <span class="h-px min-w-4 flex-1 bg-line" />
      <span class={['grid opacity-70 [&_svg]:size-3.5', props.chevron]}>
        <Chevron open={props.open} />
      </span>
    </>
  );
}

export const dividerClass =
  'flex h-6 w-full cursor-default list-none items-center gap-1.5 text-meta font-medium text-muted transition-colors select-none hover:text-fg touch:h-11 [&::-webkit-details-marker]:hidden';
