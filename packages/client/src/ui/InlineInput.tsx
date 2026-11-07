import { onSettled, untrack } from 'solid-js';

import Input from './Input';

/**
 * Renames something in place (a session title, a branch). Enter or leaving
 * the field saves, Esc cancels. It stays up until the save lands, so the old
 * name never flashes. `clean` tidies what was typed; empty means no change.
 */
export default function InlineInput(props: {
  value: string;
  label: string;
  onSave: (value: string) => Promise<unknown>;
  onClose: () => void;
  clean?: (typed: string) => string;
  maxlength?: number;
  // A name like a branch: no autocorrect or capitals on phones.
  code?: boolean;
  class?: string;
}) {
  let input: HTMLInputElement | undefined;
  let done = false;

  const finish = async (save: boolean) => {
    if (done || !input) return;
    done = true;
    const typed = input.value.replace(/\s+/g, ' ').trim();
    const value = props.clean ? props.clean(typed) : typed;
    if (save && value && value !== props.value) await props.onSave(value);
    props.onClose();
  };

  onSettled(() => {
    input?.focus();
    input?.select();
  });

  return (
    <Input
      ref={(el) => (input = el)}
      // Read once: a value arriving mid-edit must not wipe what's typed.
      value={untrack(() => props.value)}
      maxlength={props.maxlength}
      aria-label={props.label}
      enterkeyhint="done"
      autocapitalize={props.code ? 'off' : undefined}
      autocorrect={props.code ? 'off' : undefined}
      // A string: Solid drops a false attribute, which leaves spellcheck on.
      spellcheck={props.code ? 'false' : undefined}
      class={['flex-1', props.class]}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void finish(true);
        } else if (e.key === 'Escape') {
          // Only the edit: not the drawer around it.
          e.stopPropagation();
          void finish(false);
        }
      }}
      onBlur={() => void finish(true)}
    />
  );
}
