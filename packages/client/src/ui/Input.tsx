import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';

/**
 * The frame every text field shares: a hairline that darkens on focus, with
 * a soft accent ring in place of the outline. Radius by height: add
 * `rounded-md` up to 28px, `rounded-lg` from 32px (docs/UI.md).
 */
export const fieldFrame =
  'border border-line bg-surface outline-none transition-[border-color,box-shadow] duration-150 focus-within:border-line-strong focus-within:ring-3 focus-within:ring-accent/20';

/** A single-line text field. 16px on touch so iOS doesn't zoom. */
export default function Input(
  props: JSX.InputHTMLAttributes<HTMLInputElement>,
) {
  const rest = omit(props, 'class');
  return (
    <input
      {...rest}
      class={[
        fieldFrame,
        'min-w-0 rounded-md px-2 text-fg placeholder:text-muted touch:text-read',
        props.class,
      ]}
    />
  );
}
