import type { JSX } from '@solidjs/web';
import { Show, createSignal, createUniqueId } from 'solid-js';

import { DrawnCheckIcon } from './icons';
import { fieldFrame } from './Input';

/** What a field says about its value: an error blocks, a note only hints. */
export type Check = { error?: string; note?: string; ok?: boolean };

/**
 * A labelled text field that checks what you type, after the address field
 * of affectUI's Integration Settings: a check draws in once the value looks
 * right, and an error rings it red with the reason under it. Errors wait
 * until you leave the field, or `touched` says a submit was tried.
 */
export function Field(props: {
  label: JSX.Element;
  hint?: JSX.Element;
  value: string;
  onInput: (value: string) => void;
  check?: (value: string) => Check;
  touched?: boolean;
  /** Fixed text before the value, like `https://`. */
  prefix?: string;
  type?: 'text' | 'url' | 'password';
  placeholder?: string;
  required?: boolean;
  autofocus?: boolean;
}) {
  const id = createUniqueId();
  const [left, setLeft] = createSignal(false, { name: 'fieldLeft' });
  const result = (): Check =>
    props.value.trim() && props.check ? props.check(props.value) : {};
  const error = () =>
    (left() || props.touched) && props.value.trim()
      ? result().error
      : undefined;
  return (
    <div class="flex flex-col gap-1.5">
      <label class="text-meta font-medium" for={id}>
        {props.label}
      </label>
      <span
        class={[
          fieldFrame,
          'flex h-9 items-center gap-1 rounded-lg px-2.5 data-invalid:border-danger data-invalid:ring-3 data-invalid:ring-danger/15 touch:h-11',
        ]}
        data-invalid={error() ? '' : undefined}
      >
        <Show when={props.prefix}>
          <span class="shrink-0 text-muted">{props.prefix}</span>
        </Show>
        <input
          id={id}
          class="h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-muted touch:text-read"
          type={props.type ?? 'text'}
          value={props.value}
          placeholder={props.placeholder}
          required={props.required}
          autofocus={props.autofocus}
          autocomplete="off"
          spellcheck="false"
          aria-invalid={error() ? 'true' : undefined}
          aria-describedby={`${id}-hint`}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onBlur={() => setLeft(true)}
        />
        <Show when={result().ok && !result().error}>
          <span class="swap-in shrink-0 text-running" aria-hidden="true">
            <DrawnCheckIcon />
          </span>
        </Show>
      </span>
      <Show when={error() ?? result().note ?? props.hint}>
        <p
          id={`${id}-hint`}
          class={['text-meta', error() ? 'text-danger' : 'text-muted']}
        >
          {error() ?? result().note ?? props.hint}
        </p>
      </Show>
    </div>
  );
}

// What each provider's keys start with, to catch a key pasted in the wrong
// place. A different start only hints: formats change.
const KEY_PREFIX: Record<string, string> = {
  anthropic: 'sk-ant-',
  openai: 'sk-',
  openrouter: 'sk-or-',
};

/** An API key: one word, long enough, and the provider's usual start. */
export function checkKey(provider: string, name: string) {
  return (value: string): Check => {
    const key = value.trim();
    if (/\s/.test(key)) return { error: 'A key has no spaces in it' };
    if (key.length < 20) return { error: 'Too short for a key' };
    const prefix = KEY_PREFIX[provider];
    if (prefix && !key.startsWith(prefix))
      return { ok: true, note: `${name} keys usually start with ${prefix}` };
    return { ok: true };
  };
}
