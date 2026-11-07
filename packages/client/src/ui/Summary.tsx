import type { JSX } from '@solidjs/web';

/** The classes of a `Summary`, for a `<summary>` built by hand. */
export const summaryClass =
  'flex h-7 list-none items-center gap-2 rounded-md px-1.5 text-muted transition-colors select-none hover:bg-hover hover:text-fg touch:h-11 [&::-webkit-details-marker]:hidden';

/** The clickable row of a `<details>`, without the browser's marker. */
export default function Summary(props: {
  children: JSX.Element;
  class?: string;
}) {
  return (
    <summary class={[summaryClass, props.class]}>{props.children}</summary>
  );
}
