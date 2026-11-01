import type { JSX } from '@solidjs/web';

import Input from './Input';

// Literal classes, so Tailwind sees them: where it opens from its button,
// and which corner it grows from.
const PLACE = {
  'bottom-start':
    'md:mt-1 md:origin-top-left md:[position-area:bottom_span-right]',
  'bottom-end':
    'md:mt-1 md:origin-top-right md:[position-area:bottom_span-left]',
  'top-start':
    'md:mb-1 md:origin-bottom-left md:[position-area:top_span-right]',
  'top-end': 'md:mb-1 md:origin-bottom-right md:[position-area:top_span-left]',
};
const WIDTH = { sm: 'md:w-72', md: 'md:w-80', lg: 'md:w-96' };

/**
 * A menu panel by the button with `popovertarget={id}` and
 * `style={{ 'anchor-name': `--${id}` }}`, flipping to the other side when
 * there's no room. A sheet from the bottom on phones. The children sit in
 * the white card (`card` adds to its classes), as in the model picker.
 */
export function Popover(props: {
  id: string;
  label: string;
  place?: keyof typeof PLACE;
  ref?: (el: HTMLDivElement) => void;
  onToggle?: (open: boolean) => void;
  width?: keyof typeof WIDTH;
  card?: string;
  /** A line on the tray under the card, like the picked model's price. */
  tray?: JSX.Element;
  children: JSX.Element;
}) {
  return (
    <div
      ref={props.ref}
      id={props.id}
      popover="auto"
      role="dialog"
      aria-label={props.label}
      style={{ '--anchor': `--${props.id}` }}
      onToggle={(e) => props.onToggle?.(e.newState === 'open')}
      class={[
        'm-0 flex-col overflow-hidden bg-panel p-1 text-fg shadow-menu open:flex max-md:sheet max-md:shadow-sheet md:pop',
        'inset-x-0 top-auto bottom-0 w-full max-w-none rounded-t-tray pb-[env(safe-area-inset-bottom)] backdrop:bg-backdrop',
        'md:inset-auto md:rounded-tray md:pb-1 md:backdrop:bg-transparent md:[position-anchor:var(--anchor)] md:[position-try-fallbacks:flip-block]',
        PLACE[props.place ?? 'bottom-start'],
        WIDTH[props.width ?? 'md'],
      ]}
    >
      <div
        class={[
          'flex min-h-0 flex-col overflow-hidden rounded-sheet border border-line bg-surface',
          props.card,
        ]}
      >
        {props.children}
      </div>
      {props.tray}
    </div>
  );
}

/**
 * The search field at the top of a Popover. With `controls`, it drives the
 * list by keyboard as a combobox, and `activeId` names the row it's on.
 */
export function PopoverSearch(props: {
  ref?: (el: HTMLInputElement) => void;
  controls?: string;
  activeId?: string;
  label: string;
  placeholder?: string;
  value?: string;
  onInput: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
}) {
  return (
    <div class="border-b border-line p-1.5">
      <Input
        ref={props.ref}
        class="h-8 w-full touch:h-11"
        type="search"
        aria-label={props.label}
        role={props.controls ? 'combobox' : undefined}
        aria-controls={props.controls}
        aria-expanded={props.controls ? 'true' : undefined}
        aria-activedescendant={props.activeId}
        placeholder={props.placeholder ?? `${props.label}…`}
        value={props.value}
        autocomplete="off"
        spellcheck="false"
        onInput={(e) => props.onInput(e.currentTarget.value)}
        onKeyDown={(e) => props.onKeyDown?.(e)}
      />
    </div>
  );
}
