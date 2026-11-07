import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';

import { buttonClass, type Size } from './Button';

/** A native select that looks like a ghost button. */
export default function Select(
  props: JSX.SelectHTMLAttributes<HTMLSelectElement> & {
    // Not `size`: on a select that's the number of visible rows.
    controlSize?: Size;
  },
) {
  const rest = omit(props, 'class', 'controlSize');
  return (
    <select
      {...rest}
      class={[
        buttonClass({ size: props.controlSize ?? 'md' }),
        'min-w-0 truncate bg-transparent touch:text-read',
        props.class,
      ]}
    />
  );
}
