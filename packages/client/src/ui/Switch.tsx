/**
 * An on/off switch: a pill whose knob slides across. A real `role="switch"`
 * button; name it with `label`, or put it inside a `<label>` with its text.
 */
export function Switch(props: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label?: string;
  disabled?: boolean;
  class?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked ? 'true' : 'false'}
      aria-label={props.label}
      disabled={props.disabled}
      class={[
        'group/switch relative inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-line-strong transition-colors duration-200 disabled:opacity-40 aria-checked:bg-fg touch:h-6 touch:w-10',
        props.class,
      ]}
      onClick={(e) => {
        // Inside a <label>, the click would land twice.
        e.preventDefault();
        props.onChange(!props.checked);
      }}
    >
      <span class="ml-0.5 size-3 rounded-full bg-surface shadow-thumb transition-transform duration-200 ease-out group-aria-checked/switch:translate-x-3 touch:size-5 touch:group-aria-checked/switch:translate-x-4" />
    </button>
  );
}
