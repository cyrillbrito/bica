import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';

const RAYS = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * The one spinner: eight rays lit one after another, so it turns without
 * rotating (affectUI's Thinking Loader). Sized like an icon, so a parent's
 * `[&_svg]:size-*` sizes it too. It stays on under reduced motion: it says
 * work is happening.
 */
export function Spinner(props: {
  class?: JSX.HTMLAttributes<SVGSVGElement>['class'];
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      class={['size-4 shrink-0 stroke-current', props.class]}
      aria-hidden="true"
      data-spinner=""
    >
      <For each={RAYS}>
        {(i) => (
          <line
            x1="8"
            y1="1.75"
            x2="8"
            y2="4.75"
            stroke-width="1.6"
            stroke-linecap="round"
            transform={`rotate(${i * 45} 8 8)`}
            class="animate-ray opacity-20"
            style={{ 'animation-delay': `${(i - 8) * 100}ms` }}
          />
        )}
      </For>
    </svg>
  );
}
