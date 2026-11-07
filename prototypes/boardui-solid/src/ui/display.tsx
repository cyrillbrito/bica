// Ports of BoardUI's badges/badge.tsx, badges/chip.tsx, badges/status-dot.tsx,
// kbd/kbd.tsx, avatar/avatar.tsx and divider/divider.tsx (MIT). These had no
// behavior, so only the props changed (className → class, children as JSX).
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

import { cx } from './cx';

export function Badge(props: {
  color?: 'primary' | 'neutral';
  class?: string;
  children: JSX.Element;
}) {
  return (
    <span
      class={cx(
        'inline-flex items-center justify-center rounded-sm px-1 py-px text-caption-1-semibold tracking-normal whitespace-nowrap',
        props.color === 'primary'
          ? 'bg-accent-400 text-white'
          : 'bg-badge-neutral-background text-text-secondary',
        props.class,
      )}
    >
      {props.children}
    </span>
  );
}

export type ChipColor =
  | 'orange'
  | 'lime'
  | 'rose'
  | 'yellow'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'neutral'
  | 'gray'
  | 'soft';

const chip = {
  variant: {
    bold: 'py-0.5 text-body-medium',
    subtle: 'py-1 text-body-medium',
    caption: 'py-1 text-caption-1-medium',
  },
  color: {
    orange: 'bg-status-orange-background text-status-orange-text',
    lime: 'bg-status-lime-background text-status-lime-text',
    rose: 'bg-status-rose-background text-status-rose-text',
    yellow: 'bg-status-yellow-background text-status-yellow-text',
    cyan: 'bg-status-cyan-background text-status-cyan-text',
    blue: 'bg-status-blue-background text-status-blue-text',
    purple: 'bg-status-purple-background text-status-purple-text',
    neutral: 'bg-background-tertiary-default text-text-secondary',
    gray: 'bg-background-secondary-default text-text-primary',
    soft: 'bg-background-secondary-default text-text-secondary',
  },
};

export function Chip(props: {
  variant?: keyof typeof chip.variant;
  color?: ChipColor;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <span
      class={cx(
        'inline-flex items-center justify-center gap-1 rounded-md px-1.5 whitespace-nowrap',
        chip.variant[props.variant ?? 'bold'],
        chip.color[props.color ?? 'neutral'],
        props.class,
      )}
    >
      {props.children}
    </span>
  );
}

const dot = {
  halo: {
    green: 'bg-status-dot-green-halo',
    yellow: 'bg-status-dot-yellow-halo',
    indigo: 'bg-status-dot-indigo-halo',
  },
  dot: {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    indigo: 'bg-indigo-500',
  },
};

export type StatusDotColor = keyof typeof dot.dot;

export function StatusDot(props: { color?: StatusDotColor; class?: string }) {
  return (
    <span
      aria-hidden="true"
      class={cx(
        'inline-flex size-3 shrink-0 items-center justify-center rounded-full',
        dot.halo[props.color ?? 'green'],
        props.class,
      )}
    >
      <span
        class={cx('size-1.5 rounded-full', dot.dot[props.color ?? 'green'])}
      />
    </span>
  );
}

export function Kbd(props: { class?: string; children: JSX.Element }) {
  return (
    <kbd
      class={cx(
        'inline-flex items-center justify-center rounded-full bg-kbd-background px-1 py-0.5 font-sans text-caption-1-semibold tracking-normal whitespace-nowrap text-kbd-foreground',
        props.class,
      )}
    >
      {props.children}
    </kbd>
  );
}

const avatar = {
  size: {
    xs: 'size-5 text-[10px] leading-[15px] font-semibold',
    sm: 'size-6 text-caption-1-semibold tracking-normal',
    md: 'size-8 text-headline-semibold',
    lg: 'size-9 text-[18px] leading-6 font-semibold',
  },
  color: {
    neutral: 'bg-avatar-neutral-background text-text-secondary',
    blue: 'bg-blue-300 text-blue-900',
    lime: 'bg-lime-200 text-lime-700',
    pink: 'bg-pink-200 text-pink-500',
  },
};

export type AvatarColor = keyof typeof avatar.color;

export function Avatar(props: {
  size?: keyof typeof avatar.size;
  color?: AvatarColor;
  src?: string;
  alt?: string;
  initials?: string;
  class?: string;
}) {
  return (
    <span
      class={cx(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-center align-middle',
        avatar.size[props.size ?? 'md'],
        avatar.color[props.color ?? 'neutral'],
        props.class,
      )}
    >
      <Show when={props.src} fallback={props.initials}>
        <img
          src={props.src}
          alt={props.alt ?? ''}
          loading="lazy"
          decoding="async"
          class="size-full object-cover"
        />
      </Show>
    </span>
  );
}

const divider = {
  line: 'h-px min-w-0 flex-1 bg-separator-border',
  align: {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
  },
  withContent: {
    single: 'flex items-center gap-3',
    double: 'flex items-center border-y border-separator-border py-2.5',
    fill: 'flex items-center rounded-2lg bg-background-secondary-default px-4 py-2.5',
  },
  empty: {
    single: 'h-px bg-separator-border',
    double: 'h-2 border-y border-separator-border',
    fill: 'h-2 rounded-full bg-background-secondary-default',
  },
};

export function Divider(props: {
  variant?: 'single' | 'double' | 'fill';
  align?: 'start' | 'center' | 'end';
  class?: string;
  children?: JSX.Element;
}) {
  const variant = () => props.variant ?? 'single';
  const align = () => props.align ?? 'center';
  return (
    <Show
      when={props.children}
      fallback={
        <div
          role="separator"
          class={cx('w-full', divider.empty[variant()], props.class)}
        />
      }
    >
      <div
        class={cx(
          'w-full',
          divider.withContent[variant()],
          divider.align[align()],
          props.class,
        )}
      >
        <Show when={variant() === 'single' && align() !== 'start'}>
          <span aria-hidden="true" class={divider.line} />
        </Show>
        <div class="shrink-0 text-body-medium text-text-secondary">
          {props.children}
        </div>
        <Show when={variant() === 'single' && align() !== 'end'}>
          <span aria-hidden="true" class={divider.line} />
        </Show>
      </div>
    </Show>
  );
}
