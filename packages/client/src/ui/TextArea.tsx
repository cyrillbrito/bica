import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';

import { fieldFrame } from './Input';

/**
 * A text box that grows with what's typed (`field-sizing: content`); cap it
 * with `max-h-*` and pad it in `class`. `framed` draws the field's own
 * frame; without it, it sits bare inside a box that has one (the commit box).
 */
export default function TextArea(
  props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & { framed?: boolean },
) {
  const rest = omit(props, 'class', 'framed');
  return (
    <textarea
      {...rest}
      class={[
        'resize-none leading-snug text-fg [field-sizing:content] placeholder:text-muted touch:text-read',
        props.framed
          ? [fieldFrame, 'rounded-card']
          : 'bg-transparent outline-none',
        props.class,
      ]}
    />
  );
}
