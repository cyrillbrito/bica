import { For, Show, createMemo, createSignal } from 'solid-js';

import type { SessionSummary, TerminalInfo } from '@bica/shared/protocol';
import { isBusy } from '@bica/shared/status';
import { setArchived } from './sessions';
import { detachTerminal, useTerminals } from '../terminals/terminals';
import { Button } from '../ui/Button';
import { CheckMark } from '../ui/CheckMark';
import { Dialog } from '../ui/Dialog';
import { OptionGroup, OptionList, optionClass } from '../ui/Option';
import { toast } from '../ui/Toast';

type Choice = { ids: string[]; detach: string[] } | null;

let dialog: HTMLDialogElement | undefined;
let readTerminals: () => readonly TerminalInfo[] = () => [];
const [parent, setParent] = createSignal<SessionSummary>();
const [children, setChildren] = createSignal<SessionSummary[]>([]);
// Led by the parent or one of its open child sessions.
const [shells, setShells] = createSignal<TerminalInfo[]>([]);
const [picked, setPicked] = createSignal<ReadonlySet<string>>(new Set(), {
  name: 'archivePicked',
});
const [closing, setClosing] = createSignal<ReadonlySet<string>>(new Set(), {
  name: 'archiveClosing',
});
let settle: (choice: Choice) => void = () => {};

/** Every open child session of `id`, and their children. */
function descendants(id: string, all: readonly SessionSummary[]) {
  const out: SessionSummary[] = [];
  const queue = [id];
  while (queue.length) {
    const from = queue.shift();
    for (const s of all)
      if (s.parent === from && !s.archivedAt && !out.includes(s)) {
        out.push(s);
        queue.push(s.id);
      }
  }
  return out;
}

/**
 * The sessions to archive along with `s`, itself included, and the
 * terminals to detach so they stay open; null when cancelled. Asks only when
 * `s` leads open child sessions or terminals. Sessions come unpicked and
 * terminals picked: a dev server is rarely worth keeping, a child session's
 * work often is. Whatever is left is detached, and ones detached already are
 * the user's, so they aren't offered.
 */
function askArchive(
  s: SessionSummary,
  all: readonly SessionSummary[],
): Promise<Choice> {
  const kids = descendants(s.id, all);
  const ids = [s.id, ...kids.map((k) => k.id)];
  const led = readTerminals().filter((t) => t.parent && ids.includes(t.parent));
  if (!kids.length && !led.some((t) => t.parent === s.id))
    return Promise.resolve({ ids: [s.id], detach: [] });
  setParent(s);
  setChildren(kids);
  setShells(led);
  setPicked(new Set<string>());
  setClosing(new Set(led.map((t) => t.id)));
  dialog?.showModal();
  return new Promise((resolve) => (settle = resolve));
}

/**
 * Archives `s` and the sessions picked to go with it, closing the terminals
 * they lead unless unpicked. `leave` runs first with their ids, to step off a
 * page that is about to vanish.
 */
export async function archiveWithChildren(
  s: SessionSummary,
  all: readonly SessionSummary[],
  leave?: (ids: string[]) => void,
) {
  const choice = await askArchive(s, all);
  if (!choice) return;
  const closed = readTerminals().filter(
    (t) =>
      t.parent &&
      choice.ids.includes(t.parent) &&
      !choice.detach.includes(t.id),
  ).length;
  try {
    // First, or archiving would close them.
    await Promise.all(choice.detach.map((id) => detachTerminal(id)));
  } catch (e) {
    return void toast.error(e);
  }
  leave?.(choice.ids);
  await setArchived(
    all.filter((o) => choice.ids.includes(o.id)),
    true,
    closed ? `Closed ${closed} terminal${closed === 1 ? '' : 's'}` : undefined,
  );
}

function finish(choice: Choice) {
  const done = settle;
  settle = () => {};
  done(choice);
  dialog?.close();
}

export default function ArchiveDialog() {
  const terminals = useTerminals();
  readTerminals = terminals;
  const toggle = (
    get: () => ReadonlySet<string>,
    set: (v: ReadonlySet<string>) => void,
    id: string,
  ) => {
    const next = new Set(get());
    if (!next.delete(id)) next.add(id);
    set(next);
  };
  // A child session's terminals show once it's picked to go too.
  const shown = createMemo(
    () =>
      shells().filter(
        (t) => t.parent === parent()?.id || picked().has(t.parent!),
      ),
    { name: 'archiveShells' },
  );
  const count = () => 1 + picked().size;
  const confirm = () =>
    finish({
      ids: [parent()!.id, ...picked()],
      detach: shown()
        .filter((t) => !closing().has(t.id))
        .map((t) => t.id),
    });

  return (
    <Dialog
      ref={(el) => (dialog = el)}
      title={parent()?.title || 'Archive session'}
      class="md:w-[28rem]"
      onClose={() => finish(null)}
      footer={
        <>
          <Button variant="ghost" onClick={() => finish(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm}>
            {count() > 1 ? `Archive ${count()} sessions` : 'Archive'}
          </Button>
        </>
      }
    >
      <p class="px-4 pt-3 pb-1 text-muted">
        Checked ones are archived or closed with it. The rest are detached and
        stay open.
      </p>
      <OptionList inset={2} class="flex-1">
        <Show when={children().length}>
          <OptionGroup>Child sessions</OptionGroup>
        </Show>
        <For each={children()} keyed={(s) => s.id}>
          {(s) => (
            <button
              type="button"
              role="checkbox"
              aria-checked={picked().has(s().id) ? 'true' : 'false'}
              disabled={isBusy(s().status)}
              class={['group/opt', optionClass]}
              onClick={() => toggle(picked, setPicked, s().id)}
            >
              <CheckMark on={picked().has(s().id)} />
              <span class="min-w-0 flex-1 truncate">
                {s().title || 'Untitled'}
              </span>
            </button>
          )}
        </For>
        <Show when={shown().length}>
          <OptionGroup>Terminals</OptionGroup>
        </Show>
        <For each={shown()} keyed={(t) => t.id}>
          {(t) => (
            <button
              type="button"
              role="checkbox"
              aria-checked={closing().has(t().id) ? 'true' : 'false'}
              class={['group/opt', optionClass]}
              onClick={() => toggle(closing, setClosing, t().id)}
            >
              <CheckMark on={closing().has(t().id)} />
              <span class="min-w-0 flex-1 truncate">{t().title}</span>
            </button>
          )}
        </For>
      </OptionList>
    </Dialog>
  );
}
