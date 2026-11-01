import { Dynamic } from '@solidjs/web';
import {
  For,
  Loading,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
} from 'solid-js';

import { Button } from '../../ui/Button';
import { ChevronIcon, SearchIcon } from '../../ui/icons';
import { useCommands } from './pages';
import { keyLabel, matches, search, type Command, type Page } from './commands';
import { createActiveOption } from '../../ui/listKeys';
import { NoMatches, OptionGroup, optionClass } from '../../ui/Option';

let dialog: HTMLDialogElement | undefined;
let input: HTMLInputElement | undefined;
const [stack, setStack] = createSignal<Page[]>([], { name: 'paletteStack' });
const [query, setQuery] = createSignal('', { name: 'paletteQuery' });

/** Opens the palette at its root page. */
export function openPalette() {
  setStack([]);
  setQuery('');
  if (input) input.value = '';
  if (!dialog?.open) dialog?.showModal();
  input?.focus();
}

function closePalette() {
  dialog?.close();
}

/**
 * ⌘K: one search over sessions, workspaces, and actions, whose rows can open
 * a second page for a pick that needs one. A full screen on the phone.
 */
export default function CommandPalette() {
  const { root, actions, shortcutsPage } = useCommands();
  const page = () => stack().at(-1) ?? root;

  const results = createMemo(() => search(page(), query()), {
    name: 'paletteResults',
    lazy: true,
  });

  const choose = (c: Command | undefined) => {
    if (!c) return;
    if (c.page) {
      setStack((s) => [...s, c.page!()]);
      setQuery('');
      if (input) input.value = '';
      return;
    }
    if (!c.run) return;
    closePalette();
    c.run();
  };

  const back = () => {
    setStack((s) => s.slice(0, -1));
    setQuery('');
    if (input) input.value = '';
  };

  onSettled(() => {
    // Capture: runs before the composer or a terminal handles the key.
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (matches(e, { code: 'KeyK', mod: true })) {
        e.preventDefault();
        e.stopPropagation();
        if (dialog?.open) closePalette();
        else openPalette();
        return;
      }
      if (matches(e, { code: 'Slash', mod: true })) {
        e.preventDefault();
        e.stopPropagation();
        openPalette();
        setStack([shortcutsPage()]);
        return;
      }
      const c = actions().find((c) => c.keys && matches(e, c.keys) && c.run);
      if (!c) return;
      e.preventDefault();
      e.stopPropagation();
      if (dialog?.open) closePalette();
      c.run!();
    };
    addEventListener('keydown', onKey, true);
    return () => removeEventListener('keydown', onKey, true);
  });

  const nav = createActiveOption({
    id: 'palette',
    count: () => results().length,
    choose: (i) => choose(results()[i]),
  });
  // Every new page, and every opening, starts at the top.
  createEffect(stack, () => {
    nav.reset();
  });

  const onInputKey = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !input?.value && stack().length) {
      e.preventDefault();
      back();
    } else nav.onKeyDown(e);
  };

  return (
    <dialog
      ref={(el) => (dialog = el)}
      class={[
        'm-auto mt-[12dvh] flex max-h-[min(34rem,76dvh)] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-card border border-line bg-panel text-fg shadow-sheet backdrop:bg-backdrop not-open:hidden',
        // Phone: the whole screen, so the list gets all the room the keyboard leaves.
        'max-md:m-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:pt-[env(safe-area-inset-top)]',
      ]}
      aria-label="Command palette"
      onClick={(e) => e.target === e.currentTarget && closePalette()}
      onCancel={(e) => {
        // Esc steps back out of a second page before it closes.
        if (!stack().length) return;
        e.preventDefault();
        back();
      }}
    >
      <Loading fallback={<div class="h-12" />}>
        <div class="flex h-12 shrink-0 items-center gap-2 border-b border-line pr-2 pl-3.5 touch:h-14">
          <span class="text-muted">
            <SearchIcon />
          </span>
          <Show when={page().title}>
            <button
              class="shrink-0 rounded-sm bg-surface px-1.5 text-meta text-muted transition-colors hover:text-fg"
              title="Back"
              onClick={() => {
                back();
                input?.focus();
              }}
            >
              {page().title}
            </button>
          </Show>
          <input
            ref={(el) => (input = el)}
            class="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted touch:text-read"
            placeholder={page().placeholder}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={nav.activeId()}
            autocomplete="off"
            spellcheck="false"
            onInput={(e) => {
              setQuery(e.currentTarget.value);
              nav.move(0);
            }}
            onKeyDown={onInputKey}
          />
          <Button size="sm" class="md:hidden" onClick={closePalette}>
            Cancel
          </Button>
        </div>
        <ul
          id="palette-list"
          role="listbox"
          aria-label={page().title ?? 'Commands'}
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
        >
          <For
            each={results()}
            keyed={(c) => c.id}
            fallback={
              <li>
                <NoMatches>
                  {page().raw ? page().placeholder : undefined}
                </NoMatches>
              </li>
            }
          >
            {(c, i) => (
              <>
                <Show
                  when={
                    c().group &&
                    (i() === 0 || results()[i() - 1]?.group !== c().group)
                  }
                >
                  <li role="presentation">
                    <OptionGroup>{c().group}</OptionGroup>
                  </li>
                </Show>
                <li
                  id={nav.optionId(i())}
                  role="option"
                  aria-selected={i() === nav.active() ? 'true' : 'false'}
                  data-active={i() === nav.active() ? '' : undefined}
                  class={optionClass}
                  onPointerMove={() => nav.hover(i())}
                  onClick={() => choose(c())}
                >
                  <span class="grid w-4 shrink-0 place-items-center text-muted">
                    <Show when={c().icon}>
                      {(icon) => <Dynamic component={icon()} />}
                    </Show>
                  </span>
                  <span class="flex min-w-0 flex-1 items-baseline gap-2">
                    <span class="truncate" dir="auto">
                      {c().label}
                    </span>
                    <Show when={c().hint}>
                      <span class="min-w-0 flex-1 truncate text-meta text-muted">
                        {c().hint}
                      </span>
                    </Show>
                  </span>
                  <Show
                    when={c().keys}
                    fallback={
                      <Show
                        when={c().page}
                        fallback={
                          <Show when={c().meta}>
                            <span class="shrink-0 text-meta text-muted tabular-nums">
                              {c().meta}
                            </span>
                          </Show>
                        }
                      >
                        <span class="text-muted">
                          <ChevronIcon />
                        </span>
                      </Show>
                    }
                  >
                    {(keys) => (
                      <kbd class="shrink-0 font-ui text-meta tracking-wider text-muted">
                        {keyLabel(keys())}
                      </kbd>
                    )}
                  </Show>
                </li>
              </>
            )}
          </For>
        </ul>
      </Loading>
    </dialog>
  );
}
