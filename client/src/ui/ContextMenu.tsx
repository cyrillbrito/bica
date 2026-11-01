import type { JSX } from '@solidjs/web';
import { For, Show, createEffect, createSignal, onSettled } from 'solid-js';
import { IconButton } from './Button';
import { createHighlight } from './Highlight';
import { moveFocus } from './listKeys';
import { MoreIcon } from './icons';
import Kbd from './Kbd';

export interface MenuItem {
  label: string;
  icon?: JSX.Element;
  onSelect: () => void;
  danger?: boolean;
  // true, or the reason, which shows as a tooltip.
  disabled?: boolean | string;
  hint?: string;
  // A shortcut that does the same, shown on the right: "⌘K".
  keys?: string;
}

export type MenuEntry = MenuItem | 'separator';

interface Opened {
  x: number;
  y: number;
  items: MenuEntry[];
}

const [opened, setOpened] = createSignal<Opened | undefined>(undefined, {
  name: 'contextMenu',
});
let menu: HTMLDivElement | undefined;
// Where focus was before the menu opened, to give it back.
let returnTo: HTMLElement | null = null;

// A finger held for this long opens the menu; iOS never sends `contextmenu`.
const LONG_PRESS_MS = 450;
// The lift that ends a long press would click the row under it.
let swallowClickUntil = 0;
let pressed = false;

const MARGIN = 8;

// The row the menu belongs to stays highlighted while it's open.
let owner: HTMLElement | undefined;

export function openContextMenu(
  x: number,
  y: number,
  items: MenuEntry[],
  from?: HTMLElement,
) {
  if (!items.length) return;
  owner?.removeAttribute('data-menu-open');
  owner = from;
  owner?.setAttribute('data-menu-open', '');
  setOpened({ x, y, items });
}

/**
 * A "⋯" button that opens `items` under itself: the visible way in on touch,
 * where a long press is hidden. Usually `class="hidden touch:grid"`.
 */
export function MenuButton(props: {
  items: () => MenuEntry[];
  class?: string;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <IconButton
      size={props.size ?? 'sm'}
      class={props.class}
      title={props.title ?? 'More actions'}
      aria-haspopup="menu"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const btn = e.currentTarget;
        const r = btn.getBoundingClientRect();
        const row = btn.closest<HTMLElement>('.context-target') ?? btn;
        openContextMenu(r.right - 200, r.bottom + 4, props.items(), row);
      }}
    >
      <MoreIcon />
    </IconButton>
  );
}

/**
 * Spread onto any element to give it a menu: right click, the menu key or
 * Shift+F10, and a long press on touch. `items` is read when the menu opens,
 * so it can look at current state.
 *
 *   <li class="context-target" {...contextMenu(() => [{ label: 'Archive', onSelect }])}>
 *
 * Add `context-target` to the element so a long press doesn't select text.
 */
export function contextMenu(items: () => MenuEntry[]) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startX = 0;
  let startY = 0;
  let target: HTMLElement | undefined;
  const cancel = () => {
    clearTimeout(timer);
    target?.removeAttribute('data-pressing');
  };

  return {
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      let { clientX: x, clientY: y } = e;
      // From the keyboard there's no pointer: open at the element.
      if (!x && !y) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        x = rect.left + 16;
        y = rect.bottom - 4;
      }
      openContextMenu(x, y, items(), e.currentTarget as HTMLElement);
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      startX = e.clientX;
      startY = e.clientY;
      cancel();
      target = e.currentTarget as HTMLElement;
      // Drives the hold animation in App.css (`context-target`).
      target.setAttribute('data-pressing', '');
      timer = setTimeout(() => {
        pressed = true;
        target?.removeAttribute('data-pressing');
        // Belt and braces: iOS may have started a selection anyway.
        getSelection()?.removeAllRanges();
        navigator.vibrate?.(8);
        openContextMenu(startX, startY, items(), target);
      }, LONG_PRESS_MS);
    },
    // Scrolling cancels the pointer; a small wobble of the finger doesn't.
    onPointerMove: (e: PointerEvent) => {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
  };
}

function isOpen() {
  return !!menu?.matches(':popover-open');
}

function close(restoreFocus = true) {
  if (!isOpen()) return;
  menu!.hidePopover();
  setOpened(undefined);
  owner?.removeAttribute('data-menu-open');
  owner = undefined;
  if (restoreFocus) returnTo?.focus({ preventScroll: true });
  returnTo = null;
}

/** Closes the open menu, if any, leaving focus where it is. */
export function closeContextMenu() {
  return close(false);
}

function enabled() {
  return [
    ...(menu?.querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)') ??
      []),
  ];
}

/** Mount once, near the root. Every `contextMenu` target opens this one. */
export default function ContextMenu() {
  // The hover fill glides between items; keyboard focus doesn't move it.
  const highlight = createHighlight();
  onSettled(() => {
    const onUp = () => {
      if (!pressed) return;
      pressed = false;
      swallowClickUntil = Date.now() + 400;
    };
    const onClick = (e: MouseEvent) => {
      if (Date.now() > swallowClickUntil) return;
      e.preventDefault();
      e.stopPropagation();
    };
    // The popover is manual: light dismiss would close it on the pointerup
    // of the right click that opened it.
    const onDown = (e: PointerEvent) => {
      if (isOpen() && !menu!.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isOpen()) return;
      // Only the menu: not the drawer behind it.
      e.stopPropagation();
      close();
    };
    // Placed in screen coordinates: any scroll or resize leaves it misplaced.
    const hide = () => close(false);
    addEventListener('pointerup', onUp, true);
    addEventListener('click', onClick, true);
    addEventListener('pointerdown', onDown, true);
    addEventListener('keydown', onKey, true);
    addEventListener('resize', hide);
    addEventListener('scroll', hide, true);
    addEventListener('blur', hide);
    return () => {
      removeEventListener('pointerup', onUp, true);
      removeEventListener('click', onClick, true);
      removeEventListener('pointerdown', onDown, true);
      removeEventListener('keydown', onKey, true);
      removeEventListener('resize', hide);
      removeEventListener('scroll', hide, true);
      removeEventListener('blur', hide);
    };
  });

  createEffect(opened, (at) => {
    if (!at || !menu) return;
    // Already open after a second right click elsewhere: only move it.
    if (!isOpen()) {
      returnTo = document.activeElement as HTMLElement | null;
      menu.showPopover();
    }
    highlight.move();
    // Layout size: the entrance scale would shrink the bounding box.
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const { clientWidth, clientHeight } = document.documentElement;
    const left = Math.max(MARGIN, Math.min(at.x, clientWidth - width - MARGIN));
    const top = Math.max(
      MARGIN,
      at.y + height > clientHeight - MARGIN ? at.y - height : at.y,
    );
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    // Grow from the pointer itself, wherever the menu landed.
    const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
    menu.style.transformOrigin = `${clamp(at.x - left, width)}px ${clamp(at.y - top, height)}px`;
    menu.focus({ preventScroll: true });
  });

  const choose = (item: MenuItem) => {
    // Close first so focus is back on the row before the action moves it.
    close();
    item.onSelect();
  };

  return (
    <div
      ref={(el) => (menu = el)}
      popover="manual"
      role="menu"
      tabindex="-1"
      class="pop fixed inset-auto m-0 min-w-48 flex-col rounded-card border border-line bg-surface p-1 text-fg shadow-menu outline-none open:flex"
      onPointerLeave={() => highlight.move()}
      onKeyDown={(e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          close();
        } else moveFocus(e, enabled());
      }}
    >
      <highlight.Pill />
      <For each={opened()?.items}>
        {(entry) => (
          <Show
            when={entry !== 'separator' && entry}
            fallback={<hr class="relative my-1 border-line" role="separator" />}
          >
            {(item) => (
              <button
                role="menuitem"
                class={[
                  'relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors outline-none touch:py-3',
                  'focus-visible:bg-active disabled:pointer-events-none',
                  // A disabled item with a reason shows it; one without fades.
                  typeof item().disabled === 'string'
                    ? 'text-muted'
                    : 'disabled:opacity-40',
                  !item().disabled &&
                    (item().danger ? 'text-danger' : 'text-fg'),
                ]}
                disabled={!!item().disabled}
                title={
                  typeof item().disabled === 'string'
                    ? (item().disabled as string)
                    : item().hint
                }
                onClick={() => choose(item())}
                onPointerEnter={(e) => highlight.move(e.currentTarget)}
              >
                <span class="grid size-4 place-items-center text-muted">
                  {item().icon}
                </span>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{item().label}</span>
                  <Show
                    when={
                      typeof item().disabled === 'string' &&
                      (item().disabled as string)
                    }
                  >
                    {(reason) => (
                      <span class="text-meta text-muted">{reason()}</span>
                    )}
                  </Show>
                </span>
                <Show when={item().keys}>
                  {(keys) => <Kbd class="-mr-1">{keys()}</Kbd>}
                </Show>
              </button>
            )}
          </Show>
        )}
      </For>
    </div>
  );
}
