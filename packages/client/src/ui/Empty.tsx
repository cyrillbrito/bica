import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

/**
 * A quiet centred message filling the space: not found, nothing picked.
 * With `icon` and `title` it becomes a small empty state, after affectUI's
 * Assistant Home: the icon on a soft round tile, a title, the text, and an
 * optional action under it.
 */
export default function Empty(props: {
  children: JSX.Element;
  icon?: JSX.Element;
  title?: string;
  action?: JSX.Element;
  // Red icon tile: something failed.
  danger?: boolean;
  class?: string;
}) {
  return (
    <div
      class={[
        'grid flex-1 place-items-center p-6 text-center text-muted',
        props.class,
      ]}
    >
      <Show when={props.icon || props.title} fallback={props.children}>
        <div class="appear flex max-w-xs flex-col items-center gap-1">
          <Show when={props.icon}>
            <span
              class={[
                'mb-2 grid size-10 place-items-center rounded-full [&_svg]:size-5',
                props.danger ? 'bg-danger/10 text-danger' : 'bg-hover',
              ]}
            >
              {props.icon}
            </span>
          </Show>
          <Show when={props.title}>
            <p class="font-medium text-fg">{props.title}</p>
          </Show>
          <div class="text-pretty">{props.children}</div>
          <Show when={props.action}>
            <div class="mt-3">{props.action}</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
