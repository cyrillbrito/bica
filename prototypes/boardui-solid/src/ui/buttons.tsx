// Ports of BoardUI's components/base/buttons/* (MIT, see LICENSE-boardui).
// Class recipes are copied as shipped; the React parts became plain elements.
import type { JSX } from '@solidjs/web';
import { Show, merge, omit } from 'solid-js';

import { cx } from './cx';
import { Glyph, type IconComponent } from './icon';

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'medium' | 'small' | 'xs';

const button = {
  base: [
    'inline-flex items-center justify-center gap-0.5 whitespace-nowrap overflow-hidden',
    'font-sans select-none cursor-pointer',
    'button-press-motion',
    'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-border-focus-ring',
    'disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
  ].join(' '),
  size: {
    medium: 'h-9 rounded-2lg p-2 text-body-medium',
    small: 'h-8 rounded-lg px-2 py-1.5 text-body-medium',
    xs: 'h-6 rounded-sm px-2 text-caption-1-semibold',
  },
  iconOnlySize: { medium: '', small: 'size-8 p-0', xs: 'size-6 p-0' },
  icon: {
    medium: 'size-5 shrink-0',
    small: 'size-[18px] shrink-0',
    xs: 'size-3.5 shrink-0',
  },
  label: {
    medium: 'inline-flex items-center justify-center px-1 shrink-0',
    small: 'inline-flex items-center justify-center px-0.5 shrink-0',
    xs: 'inline-flex items-center justify-center px-0.5 shrink-0',
  },
  variant: {
    primary: [
      'bg-button-primary text-text-white shadow-xs',
      'disabled:text-button-primary-disabled-foreground disabled:shadow-none',
    ].join(' '),
    danger: [
      'bg-button-danger text-text-white shadow-xs',
      'disabled:text-foreground-disabled-danger disabled:shadow-none',
    ].join(' '),
    secondary: [
      'bg-background-primary-default text-text-primary',
      'border border-border-button-default shadow-xs',
      'hover:bg-background-primary-hover hover:border-border-button-hover',
      'active:bg-background-primary-active active:border-border-button-active',
      'disabled:bg-background-primary-disabled disabled:border-border-button-default disabled:text-text-tertiary disabled:shadow-none',
    ].join(' '),
    ghost: [
      'bg-button-ghost-background text-button-ghost-foreground',
      'hover:bg-button-ghost-hover active:bg-button-ghost-active',
      'disabled:bg-button-ghost-disabled disabled:text-button-ghost-disabled-foreground disabled:shadow-none',
    ].join(' '),
  },
};

export type ButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'class'
> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  leadingIcon?: IconComponent;
  trailingIcon?: IconComponent;
  class?: string;
};

export function Button(props: ButtonProps) {
  const p = merge(
    {
      variant: 'primary' as ButtonVariant,
      size: 'medium' as ButtonSize,
      type: 'button' as const,
    },
    props,
  );
  const rest = omit(
    p,
    'variant',
    'size',
    'iconOnly',
    'leadingIcon',
    'trailingIcon',
    'children',
    'class',
  );
  return (
    <button
      {...rest}
      class={cx(
        button.base,
        button.size[p.size],
        button.variant[p.variant],
        p.iconOnly && button.iconOnlySize[p.size],
        p.class,
      )}
    >
      <Glyph of={p.leadingIcon} class={button.icon[p.size]} />
      <Show when={!p.iconOnly && p.children != null}>
        <span class={button.label[p.size]}>{p.children}</span>
      </Show>
      <Show when={!p.iconOnly}>
        <Glyph of={p.trailingIcon} class={button.icon[p.size]} />
      </Show>
    </button>
  );
}

/* ------------------------------------------------------------- Icon button */

const iconButton = {
  base: [
    'relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-2lg',
    'bg-background-primary-default text-foreground-icon-primary',
    'border border-border-button-default shadow-xs',
    'select-none cursor-pointer',
    'transition-[background-color,border-color,box-shadow,color] duration-150 ease',
    'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-border-focus-ring',
    'hover:bg-background-primary-hover hover:border-border-button-hover',
    'active:bg-background-primary-active active:border-border-button-active',
    'disabled:cursor-not-allowed disabled:bg-background-primary-disabled disabled:border-border-button-default disabled:text-icon-button-disabled-foreground disabled:opacity-60 disabled:shadow-none',
  ].join(' '),
  size: { medium: 'size-9', small: 'size-8' },
  icon: { medium: 'size-5 shrink-0', small: 'size-4 shrink-0' },
};

export type IconButtonProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'class' | 'children'
> & {
  icon: IconComponent;
  size?: 'medium' | 'small';
  'aria-label': string;
  class?: string;
};

export function IconButton(props: IconButtonProps) {
  const p = merge(
    { size: 'medium' as 'medium' | 'small', type: 'button' as const },
    props,
  );
  const rest = omit(p, 'icon', 'size', 'class');
  return (
    <button
      {...rest}
      class={cx(iconButton.base, iconButton.size[p.size], p.class)}
    >
      <Glyph of={p.icon} class={iconButton.icon[p.size]} />
    </button>
  );
}

/* ------------------------------------------------------------ Button group */

const group = {
  group: [
    'inline-flex items-stretch isolate',
    'rounded-2lg border border-border-button-group bg-background-primary-default shadow-xs',
    'divide-x divide-border-button-default overflow-hidden',
  ].join(' '),
  item: [
    'inline-flex items-center justify-center gap-1 whitespace-nowrap',
    'bg-background-primary-default text-text-primary font-sans select-none cursor-pointer',
    'transition-[background-color,color] duration-150 ease',
    'outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring',
    'hover:bg-background-primary-hover active:bg-background-primary-active',
    'disabled:cursor-not-allowed disabled:bg-background-primary-disabled disabled:text-text-tertiary',
  ].join(' '),
  size: {
    medium: 'h-[34px] px-3 text-body-medium',
    small: 'h-[30px] px-2.5 text-body-medium',
  },
  iconOnlySize: { medium: 'w-[34px] px-0', small: 'w-[30px] px-0' },
  icon: { medium: 'size-5 shrink-0', small: 'size-[18px] shrink-0' },
  selected: 'bg-background-primary-hover',
};

export function ButtonGroup(props: {
  children: JSX.Element;
  class?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="group"
      aria-label={props['aria-label']}
      class={cx(group.group, props.class)}
    >
      {props.children}
    </div>
  );
}

export type ButtonGroupItemProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  'class'
> & {
  size?: 'medium' | 'small';
  selected?: boolean;
  iconOnly?: boolean;
  leadingIcon?: IconComponent;
  trailingIcon?: IconComponent;
  class?: string;
};

export function ButtonGroupItem(props: ButtonGroupItemProps) {
  const p = merge(
    { size: 'medium' as 'medium' | 'small', type: 'button' as const },
    props,
  );
  const rest = omit(
    p,
    'size',
    'selected',
    'iconOnly',
    'leadingIcon',
    'trailingIcon',
    'children',
    'class',
  );
  return (
    <button
      {...rest}
      aria-pressed={p.selected ? 'true' : 'false'}
      class={cx(
        group.item,
        group.size[p.size],
        p.iconOnly && group.iconOnlySize[p.size],
        p.selected && group.selected,
        p.class,
      )}
    >
      <Glyph of={p.leadingIcon} class={group.icon[p.size]} />
      <Show when={!p.iconOnly && p.children != null}>
        <span>{p.children}</span>
      </Show>
      <Show when={!p.iconOnly}>
        <Glyph of={p.trailingIcon} class={group.icon[p.size]} />
      </Show>
    </button>
  );
}

/* ------------------------------------------------------------- Link button */

const link = {
  base: [
    'inline-flex items-center justify-center gap-1 whitespace-nowrap',
    'font-sans select-none cursor-pointer rounded-sm',
    'underline-offset-3 hover:underline',
    'transition-colors duration-150 ease',
    'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-border-focus-ring',
    'disabled:cursor-not-allowed disabled:no-underline aria-disabled:cursor-not-allowed aria-disabled:no-underline',
  ].join(' '),
  size: {
    medium: 'text-body-medium',
    small: 'text-body-medium',
    xs: 'text-caption-1-semibold',
  },
  icon: {
    medium: 'size-5 shrink-0',
    small: 'size-[18px] shrink-0',
    xs: 'size-3.5 shrink-0',
  },
  variant: {
    primary:
      'text-accent-600 active:text-accent-800 disabled:text-text-tertiary aria-disabled:text-text-tertiary',
    secondary:
      'text-text-secondary active:text-text-primary disabled:text-text-tertiary aria-disabled:text-text-tertiary',
  },
};

export type LinkButtonProps = {
  variant?: 'primary' | 'secondary';
  size?: 'medium' | 'small' | 'xs';
  leadingIcon?: IconComponent;
  trailingIcon?: IconComponent;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
  class?: string;
  children?: JSX.Element;
};

/** An `<a>` with `href`, otherwise a `<button>`. */
export function LinkButton(props: LinkButtonProps) {
  const p = merge(
    { variant: 'primary' as const, size: 'medium' as const },
    props,
  );
  const classes = () =>
    cx(link.base, link.size[p.size], link.variant[p.variant], p.class);
  const content = () => (
    <>
      <Glyph of={p.leadingIcon} class={link.icon[p.size]} />
      <span>{p.children}</span>
      <Glyph of={p.trailingIcon} class={link.icon[p.size]} />
    </>
  );
  return (
    <Show
      when={p.href !== undefined}
      fallback={
        <button
          type="button"
          disabled={p.disabled}
          onClick={() => p.onClick?.()}
          class={classes()}
        >
          {content()}
        </button>
      }
    >
      <a
        href={p.disabled ? undefined : p.href}
        aria-disabled={p.disabled && 'true'}
        class={classes()}
      >
        {content()}
      </a>
    </Show>
  );
}

/* ------------------------------------------------------------ Close button */

const close = {
  glyph: { '2xs': 6.8, xs: 10.8, sm: 12.6, md: 16.2 },
  stroke: { '2xs': 1.6, xs: 2, sm: 2, md: 2.5 },
  inset: { '2xs': 0.57, xs: 2, sm: 2, md: 2 },
  container: { '2xs': 'size-4', xs: 'size-5', sm: 'size-6', md: 'size-8' },
  base: [
    'inline-flex shrink-0 items-center justify-center rounded-full',
    'bg-background-tertiary-default text-foreground-icon-secondary',
    'select-none cursor-pointer transition-colors duration-150 ease hover:text-text-primary',
    'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-border-focus-ring',
  ].join(' '),
};

type CloseSize = keyof typeof close.container;

export function CloseButton(props: {
  size?: CloseSize;
  'aria-label': string;
  onClick?: () => void;
  class?: string;
}) {
  const size = () => props.size ?? 'xs';
  const g = () => close.glyph[size()];
  const i = () => close.inset[size()];
  return (
    <button
      type="button"
      aria-label={props['aria-label']}
      onClick={() => props.onClick?.()}
      class={cx(close.base, close.container[size()], props.class)}
    >
      <svg
        width={g()}
        height={g()}
        viewBox={`0 0 ${g()} ${g()}`}
        fill="none"
        aria-hidden="true"
      >
        <path
          d={`M${i()} ${i()}L${g() - i()} ${g() - i()}`}
          stroke="currentColor"
          stroke-width={close.stroke[size()]}
          stroke-linecap="round"
        />
        <path
          d={`M${g() - i()} ${i()}L${i()} ${g() - i()}`}
          stroke="currentColor"
          stroke-width={close.stroke[size()]}
          stroke-linecap="round"
        />
      </svg>
    </button>
  );
}
