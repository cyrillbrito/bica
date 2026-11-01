import type { JSX } from '@solidjs/web';
import { Show, createUniqueId } from 'solid-js';

import { IconButton } from './Button';
import { CloseIcon } from './icons';

/**
 * A modal on the native `<dialog>`: a bottom sheet on the phone, a centred
 * card from `md` up, with a titled header, a close button, and an optional
 * footer for its actions. Esc, the backdrop, and × all close it, which fires
 * `onClose` once. Open it with `showModal()` on the element `ref` gets.
 * `class` sizes the card (`md:w-*`, `md:h-*`); the body scrolls inside.
 */
export function Dialog(props: {
  ref?: (el: HTMLDialogElement) => void;
  title: JSX.Element;
  children: JSX.Element;
  footer?: JSX.Element;
  onClose?: () => void;
  onOpen?: () => void;
  class?: string;
}) {
  const id = createUniqueId();
  let dialog!: HTMLDialogElement;
  return (
    <dialog
      ref={(el) => {
        dialog = el;
        props.ref?.(el);
      }}
      aria-labelledby={id}
      class={[
        'flex flex-col overflow-hidden border border-line bg-panel text-fg shadow-sheet backdrop:bg-backdrop not-open:hidden',
        // Phone: a sheet from the bottom, reachable with the thumb.
        'mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-none rounded-t-sheet max-md:sheet',
        'md:pop md:m-auto md:max-h-[min(44rem,85dvh)] md:w-[32rem] md:rounded-card',
        props.class,
      ]}
      onToggle={(e) => e.newState === 'open' && props.onOpen?.()}
      onClose={() => props.onClose?.()}
      // Clicks on the backdrop land on the dialog itself.
      onClick={(e) => e.target === e.currentTarget && dialog.close()}
    >
      <header class="flex h-12 shrink-0 items-center gap-1 border-b border-line pr-2 pl-4">
        <h2 id={id} class="min-w-0 flex-1 truncate font-semibold">
          {props.title}
        </h2>
        <IconButton title="Close" onClick={() => dialog.close()}>
          <CloseIcon />
        </IconButton>
      </header>
      {props.children}
      <Show when={props.footer}>
        <footer class="flex shrink-0 justify-end gap-2 border-t border-line p-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))]">
          {props.footer}
        </footer>
      </Show>
    </dialog>
  );
}

/** The scrolling body of a Dialog without a footer: it keeps clear of the home bar. */
export const dialogBody =
  'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]';
