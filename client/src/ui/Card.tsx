import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

import { Switch } from './Switch';

/**
 * A settings section, after affectUI's Integration Settings: a grey tray
 * with the title, holding a white card of rows, and an optional line or
 * save bar under it. Without `children` the tray holds only `bare` content
 * (cards of their own, like usage meters).
 */
export function Card(props: {
  title: JSX.Element;
  description?: JSX.Element;
  /** Right of the title: a switch, a count, a button. */
  aside?: JSX.Element;
  children?: JSX.Element;
  /** Content laid straight on the tray instead of in the white card. */
  bare?: JSX.Element;
  footer?: JSX.Element;
  class?: string;
}) {
  return (
    <section class={['flex flex-col rounded-tray bg-well p-1', props.class]}>
      <header class="flex min-h-11 items-center gap-3 px-3 py-2">
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 class="font-semibold">{props.title}</h2>
          <Show when={props.description}>
            <p class="text-meta text-muted">{props.description}</p>
          </Show>
        </div>
        {props.aside}
      </header>
      <Show when={props.children}>
        <div class="flex flex-col divide-y divide-line rounded-sheet border border-line bg-surface">
          {props.children}
        </div>
      </Show>
      {props.bare}
      <Show when={props.footer}>
        <div class="px-3 pt-2 pb-1.5 text-meta text-muted">{props.footer}</div>
      </Show>
    </section>
  );
}

/** One setting in a Card: its name and hint, and the control on the right. */
export function Setting(props: {
  label: JSX.Element;
  hint?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div class="flex items-start gap-3 px-3.5 py-3 max-sm:flex-col max-sm:items-stretch">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{props.label}</span>
        <Show when={props.hint}>
          <span class="text-meta text-muted">{props.hint}</span>
        </Show>
      </span>
      <div class="flex shrink-0 items-center gap-1 max-sm:self-start">
        {props.children}
      </div>
    </div>
  );
}

/** An on/off setting: the whole row toggles it. */
export function Toggle(props: {
  label: JSX.Element;
  hint?: JSX.Element;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label class="flex items-start gap-3 px-3.5 py-3 transition-colors first:rounded-t-sheet last:rounded-b-sheet hover:bg-hover">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span>{props.label}</span>
        <Show when={props.hint}>
          <span class="text-meta text-muted">{props.hint}</span>
        </Show>
      </span>
      <Switch
        class="mt-0.5"
        checked={props.checked}
        onChange={props.onChange}
      />
    </label>
  );
}
