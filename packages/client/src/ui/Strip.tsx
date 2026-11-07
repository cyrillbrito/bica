import type { JSX } from '@solidjs/web';

const TONE = {
  muted: 'text-muted',
  accent: 'text-accent-ink',
  danger: 'text-danger-ink',
};

/**
 * One calm line on a tray, above what it's about (the composer): an icon and
 * a short label in the tone of the news, optional content after it, and an
 * action at the end.
 */
export function Strip(props: {
  tone?: keyof typeof TONE;
  icon: JSX.Element;
  label: JSX.Element;
  children?: JSX.Element;
  action?: JSX.Element;
}) {
  return (
    <div class="appear flex min-h-8 items-center gap-x-2 py-0.5 pr-1 pl-1.5 touch:min-h-11">
      <span
        class={[
          'flex min-w-0 items-center gap-1 text-meta [&_svg]:size-3.5 [&_svg]:shrink-0',
          TONE[props.tone ?? 'muted'],
        ]}
      >
        {props.icon}
        <span class="truncate">{props.label}</span>
      </span>
      <span class="flex min-w-0 flex-1 items-center">{props.children}</span>
      {props.action}
    </div>
  );
}
