import type { JSX } from '@solidjs/web';
import { Show, omit } from 'solid-js';

import { Spinner } from './Spinner';

export type Variant = 'primary' | 'soft' | 'outline' | 'ghost' | 'danger';
export type Size = 'sm' | 'md' | 'lg';

// `not-disabled:` rather than `enabled:` so the same classes work on links.
// A disabled primary drops to a quiet fill: a grey slab shouts "nothing here".
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-fg font-medium text-bg not-disabled:hover:opacity-85 disabled:bg-active disabled:text-muted',
  // A main action that stays put (commit): filled, but not a black or white slab.
  soft: 'bg-active font-medium text-fg not-disabled:hover:bg-line-strong',
  outline:
    'border border-line text-muted not-disabled:hover:border-line-strong not-disabled:hover:text-fg',
  ghost: 'text-muted not-disabled:hover:bg-hover not-disabled:hover:text-fg',
  // Ends something live (a call): red, in the place of the main action.
  danger: 'bg-danger font-medium text-bg not-disabled:hover:opacity-85',
};

// Sinks a little while pressed, so the press registers before the action,
// and springs back fast on release. Not while busy: nothing will happen.
const PRESS =
  'transition-[color,background-color,border-color,opacity,scale] duration-150 ease-out motion-safe:not-disabled:not-aria-busy:active:scale-97 aria-busy:cursor-progress';

// Heights step up to 44px hit areas on touch.
const SIZE: Record<Size, string> = {
  sm: 'h-6 gap-1 px-1.5 text-meta touch:h-9 touch:px-2.5',
  md: 'h-7 gap-1.5 px-1.5 touch:h-10',
  lg: 'h-8 gap-1.5 px-3 touch:h-11',
};

const RADIUS: Record<Size, string> = {
  sm: 'rounded-md',
  md: 'rounded-md',
  lg: 'rounded-lg',
};

const ICON_SIZE: Record<Size, string> = {
  sm: 'size-6 touch:size-9',
  md: 'size-7 touch:size-10',
  lg: 'size-8 touch:size-11',
};

// One faded look for every control that can't be used now (docs/UI.md).
export const DISABLED = 'disabled:opacity-40';
const DISABLED_PRIMARY = 'disabled:opacity-100';

type Look = { variant?: Variant; size?: Size };

/**
 * Classes for a button with text; also for links that look like one.
 * `round`: a pill, to sit next to round icon buttons.
 */
export function buttonClass(look: Look & { round?: boolean } = {}) {
  return [
    'flex shrink-0 items-center justify-center',
    VARIANT[look.variant ?? 'ghost'],
    SIZE[look.size ?? 'lg'],
    look.round ? 'rounded-full' : RADIUS[look.size ?? 'lg'],
    PRESS,
    look.variant === 'primary' ? DISABLED_PRIMARY : DISABLED,
  ].join(' ');
}

/** Classes for a square icon button; also for links that look like one. */
function iconButtonClass(look: Look & { round?: boolean } = {}) {
  return [
    'grid shrink-0 place-items-center',
    VARIANT[look.variant ?? 'ghost'],
    ICON_SIZE[look.size ?? 'lg'],
    look.round
      ? 'rounded-full'
      : (look.size ?? 'lg') === 'lg'
        ? 'rounded-lg'
        : 'rounded-md',
    PRESS,
    look.variant === 'primary' ? DISABLED_PRIMARY : DISABLED,
  ].join(' ');
}

type ButtonProps = Look & JSX.ButtonHTMLAttributes<HTMLButtonElement>;

// Clicks on a busy button do nothing, without the faded look of `disabled`.
function guard(
  props: {
    loading?: boolean;
    onClick?: JSX.EventHandlerUnion<HTMLButtonElement, MouseEvent>;
  },
  e: MouseEvent & { currentTarget: HTMLButtonElement; target: Element },
) {
  if (props.loading) return e.preventDefault();
  const h = props.onClick;
  if (typeof h === 'function') h(e);
  else if (Array.isArray(h)) h[0](h[1], e);
}

/**
 * `loading` swaps the leading icon for the spinner and dims the label under
 * a sweeping band of light (affectUI's Button). It swallows clicks without
 * greying the button out the way `disabled` does, and focus stays, so a
 * keyboard user isn't dropped. Use it for any action in flight.
 */
export function Button(
  props: ButtonProps & { loading?: boolean; round?: boolean },
) {
  const rest = omit(
    props,
    'variant',
    'size',
    'round',
    'class',
    'loading',
    'children',
    'onClick',
  );
  return (
    <button
      {...rest}
      type={props.type ?? 'button'}
      class={[buttonClass(props), props.class]}
      aria-busy={props.loading ? 'true' : undefined}
      aria-disabled={props.loading ? 'true' : props['aria-disabled']}
      onClick={(e) => guard(props, e)}
    >
      {/* `contents` until busy, so the children lay out as direct ones. A
          button without an icon only shines: a spinner would widen it. */}
      <span
        class={
          props.loading
            ? 'shine flex min-w-0 items-center justify-[inherit] gap-[inherit] [&>[data-spinner]+svg]:hidden'
            : 'contents'
        }
      >
        <Show when={props.loading}>
          <Spinner class="hidden [&:has(+svg)]:block" />
        </Show>
        {props.children}
      </span>
    </button>
  );
}

/**
 * An icon-only button. `title` is required: it's the only label. `loading`
 * shows the spinner in place of the icon, like `Button`'s.
 */
export function IconButton(
  props: ButtonProps & { title: string; round?: boolean; loading?: boolean },
) {
  const rest = omit(
    props,
    'variant',
    'size',
    'round',
    'class',
    'loading',
    'children',
    'onClick',
  );
  return (
    <button
      {...rest}
      type={props.type ?? 'button'}
      aria-label={props['aria-label'] ?? props.title}
      class={[iconButtonClass(props), props.class]}
      aria-busy={props.loading ? 'true' : undefined}
      aria-disabled={props.loading ? 'true' : props['aria-disabled']}
      onClick={(e) => guard(props, e)}
    >
      <Show when={props.loading} fallback={props.children}>
        <Spinner />
      </Show>
    </button>
  );
}
