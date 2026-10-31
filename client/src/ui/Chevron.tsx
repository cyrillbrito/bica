import type { JSX } from '@solidjs/web';

import { ChevronIcon } from './icons';

/**
 * Points right, down when `open`. Inside `<details>`, pass a `group-open/*`
 * rotation in `class` instead.
 */
export default function Chevron(props: {
  open?: boolean;
  class?: JSX.ClassValue;
}) {
  return (
    <span
      class={[
        'shrink-0 transition-transform duration-150',
        props.open && 'rotate-90',
        props.class,
      ]}
    >
      <ChevronIcon />
    </span>
  );
}
