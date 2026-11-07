import type { JSX } from '@solidjs/web';
import { Dynamic } from '@solidjs/web';
import { Show } from 'solid-js';

export type IconProps = { class?: string };
export type IconComponent = (props: IconProps) => JSX.Element;

/** A Remix icon as a component, so it can be passed by reference the way
 * BoardUI passes `leadingIcon={RiAddLine}`. */
export function icon(paths: string): IconComponent {
  return (props) => (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      class={props.class}
      innerHTML={paths}
    />
  );
}

/** Renders an optional icon reference. */
export function Glyph(props: { of?: IconComponent | null; class?: string }) {
  return (
    <Show when={props.of}>
      {(of) => <Dynamic component={of()} class={props.class} />}
    </Show>
  );
}
