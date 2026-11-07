import type { JSX } from '@solidjs/web';

/**
 * A key hint on a button or row ("⌘↵", "1"). Hidden on touch, where there
 * is no keyboard to press it with; pair the button with aria-keyshortcuts.
 */
export default function Kbd(props: {
  children: JSX.Element;
  class?: JSX.HTMLAttributes<HTMLElement>['class'];
}) {
  return (
    <kbd
      aria-hidden="true"
      class={[
        'inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-sm bg-active px-1 font-ui text-meta leading-none text-muted touch:hidden',
        props.class,
      ]}
    >
      {props.children}
    </kbd>
  );
}
