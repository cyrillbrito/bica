// Ports of BoardUI's input/input.tsx, label.tsx, hint-text.tsx and
// textarea/textarea.tsx (MIT). React Aria's TextField wiring (label ↔ input ↔
// hint ids, render-prop hover/focus state) became a plain <label>, `for` and
// `aria-describedby`, and the states moved to CSS (`hover:`, `focus-within:`,
// `has-[:disabled]:`).
import type { JSX } from '@solidjs/web';
import { Show, createSignal, createUniqueId, onSettled } from 'solid-js';

import { cx } from './cx';
import { Glyph, type IconComponent } from './icon';
import { RiInformationFill } from './icons';

export type InputSize = 'medium' | 'small';

const fieldShell = {
  base: [
    'relative flex w-full rounded-2lg',
    'bg-background-tertiary-default text-foreground-icon-tertiary',
    'ring-2 ring-inset ring-transparent',
    'transition-[background-color,box-shadow,color] duration-[var(--input-transition-ms)] ease',
  ].join(' '),
  interactive:
    'hover:ring-border-button-hover focus-within:ring-border-button-active focus-within:hover:ring-border-button-active',
  disabled:
    'has-[:disabled]:bg-input-disabled-background has-[:disabled]:text-input-disabled-foreground has-[:disabled]:ring-transparent',
  invalid: 'bg-background-tertiary-error text-foreground-icon-error',
};

const text = [
  'min-w-0 flex-1 bg-transparent border-0 outline-none p-0 m-0',
  'font-sans text-body-regular text-text-primary',
  'placeholder:text-text-tertiary focus:placeholder:text-text-primary',
  'disabled:text-input-disabled-text disabled:placeholder:text-input-disabled-text disabled:cursor-not-allowed',
  'aria-invalid:placeholder:text-text-error-placeholder',
].join(' ');

export function Label(props: {
  for?: string;
  required?: boolean;
  tooltip?: boolean;
  children: JSX.Element;
}) {
  return (
    <label
      for={props.for}
      class="flex cursor-default items-center gap-0.5 text-body-medium text-text-primary"
    >
      {props.children}
      <Show when={props.required}>
        <span
          aria-hidden="true"
          class="text-body-medium text-text-error-primary"
        >
          *
        </span>
      </Show>
      <Show when={props.tooltip}>
        <RiInformationFill class="size-4 shrink-0 text-foreground-icon-quaternary" />
      </Show>
    </label>
  );
}

export function HintText(props: {
  id?: string;
  invalid?: boolean;
  children: JSX.Element;
}) {
  return (
    <span
      id={props.id}
      class={cx(
        'pt-px text-caption-1-medium text-text-secondary',
        props.invalid && 'text-text-error-primary',
      )}
    >
      {props.children}
    </span>
  );
}

type FieldProps = {
  label?: string;
  hint?: string;
  tooltip?: boolean;
  required?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
  size?: InputSize;
  value?: string;
  onInput?: (value: string) => void;
  class?: string;
  'aria-label'?: string;
};

export function Input(
  props: FieldProps & {
    type?: string;
    leadingIcon?: IconComponent;
    trailingIcon?: IconComponent;
  },
) {
  const id = createUniqueId();
  const size = () => props.size ?? 'medium';
  const [draft, setDraft] = createSignal(() => props.value ?? '');
  return (
    <div
      class={cx(
        'group flex h-max w-full flex-col items-start gap-1',
        props.class,
      )}
    >
      <Show when={props.label}>
        <Label for={id} required={props.required} tooltip={props.tooltip}>
          {props.label}
        </Label>
      </Show>
      <div
        class={cx(
          fieldShell.base,
          'items-center',
          size() === 'medium' ? 'p-2' : 'h-8 px-1.5 py-2',
          props.invalid ? fieldShell.invalid : fieldShell.interactive,
          fieldShell.disabled,
        )}
      >
        <div class="flex w-full min-w-0 items-center gap-2">
          <div class="flex min-w-0 flex-1 items-center gap-0.5">
            <Glyph of={props.leadingIcon} class="size-5 shrink-0" />
            <input
              id={id}
              type={props.type ?? 'text'}
              value={draft()}
              onInput={(e) => {
                setDraft(e.currentTarget.value);
                props.onInput?.(e.currentTarget.value);
              }}
              placeholder={props.placeholder}
              disabled={props.disabled}
              required={props.required}
              aria-invalid={props.invalid && 'true'}
              aria-label={
                props['aria-label'] ??
                (props.label ? undefined : props.placeholder)
              }
              aria-describedby={props.hint ? `${id}-hint` : undefined}
              class={cx(text, 'pl-1 text-left')}
            />
          </div>
          <Glyph of={props.trailingIcon} class="size-5 shrink-0" />
        </div>
      </div>
      <Show when={props.hint}>
        <HintText id={`${id}-hint`} invalid={props.invalid}>
          {props.hint}
        </HintText>
      </Show>
    </div>
  );
}

/** Line box of `text-body-regular` (14/20), the fallback before styles load. */
const LINE = 20;

export function Textarea(
  props: FieldProps & {
    rows?: number;
    autoResize?: boolean;
    maxRows?: number;
    maxLength?: number;
    showCount?: boolean;
  },
) {
  const id = createUniqueId();
  const [draft, setDraft] = createSignal(() => props.value ?? '');
  const length = () => draft().length;
  let field!: HTMLTextAreaElement;

  const fit = () => {
    if (!props.autoResize) return;
    const line = parseFloat(getComputedStyle(field).lineHeight) || LINE;
    const rows = props.rows ?? 3;
    const ceiling = props.maxRows ? props.maxRows * line : Infinity;
    field.style.height = '0px';
    const next = Math.max(field.scrollHeight, rows * line);
    field.style.height = `${Math.min(next, ceiling)}px`;
    field.style.overflowY = next > ceiling ? 'auto' : 'hidden';
  };
  onSettled(fit);

  return (
    <div
      class={cx(
        'group flex h-max w-full flex-col items-start gap-1',
        props.class,
      )}
    >
      <Show when={props.label}>
        <Label for={id} required={props.required} tooltip={props.tooltip}>
          {props.label}
        </Label>
      </Show>
      <div
        class={cx(
          fieldShell.base,
          'flex-col',
          (props.size ?? 'medium') === 'medium' ? 'p-2' : 'px-1.5 py-2',
          props.invalid ? fieldShell.invalid : fieldShell.interactive,
          fieldShell.disabled,
        )}
      >
        <textarea
          ref={field}
          id={id}
          rows={props.rows ?? 3}
          value={draft()}
          maxlength={props.maxLength}
          placeholder={props.placeholder}
          disabled={props.disabled}
          aria-invalid={props.invalid && 'true'}
          aria-label={
            props['aria-label'] ?? (props.label ? undefined : props.placeholder)
          }
          onInput={(e) => {
            setDraft(e.currentTarget.value);
            fit();
            props.onInput?.(e.currentTarget.value);
          }}
          class={cx(
            text,
            'block w-full px-1',
            props.autoResize ? 'resize-none' : 'resize-y',
          )}
        />
      </div>
      <Show when={props.hint || props.showCount}>
        <div class="flex w-full items-start justify-between gap-3">
          <Show when={props.hint}>
            <HintText invalid={props.invalid}>{props.hint}</HintText>
          </Show>
          <Show when={props.showCount}>
            <span
              class={cx(
                'ms-auto shrink-0 pt-px text-caption-1-medium text-text-tertiary tabular-nums',
                props.invalid && 'text-text-error-primary',
              )}
            >
              {props.maxLength ? `${length()}/${props.maxLength}` : length()}
            </span>
          </Show>
        </div>
      </Show>
    </div>
  );
}
