import { For, Show, createSignal } from 'solid-js';

import { addProject, listDirs, setCurrentTarget } from './projects';
import type { DirListing } from '@bica/shared/protocol';
import Alert from '../ui/Alert';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ArrowUpIcon, FolderIcon } from '../ui/icons';
import { NoMatches, OptionList, optionClass } from '../ui/Option';
import { Tag } from '../ui/Tag';
import { errorText } from '../ui/errors';

let dialog: HTMLDialogElement | undefined;
const [listing, setListing] = createSignal<DirListing>();
const [error, setError] = createSignal('');

async function go(path?: string) {
  try {
    setListing(await listDirs(path));
    setError('');
  } catch (e) {
    setError(errorText(e));
  }
}

export function openProjectPicker() {
  dialog?.showModal();
  void go(listing()?.path);
}

export default function ProjectPicker() {
  const add = async () => {
    const path = listing()?.path;
    if (!path) return;
    try {
      // A worktree joins its repo's project, so pick that folder in it.
      setCurrentTarget({ projectId: await addProject(path), cwd: path });
      dialog?.close();
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <Dialog
      ref={(el) => (dialog = el)}
      title="Add project"
      class="md:h-[min(36rem,85dvh)]"
      footer={
        <Button variant="primary" disabled={!listing()} onClick={add}>
          Add this folder
        </Button>
      }
    >
      <div class="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2">
        <IconButton
          title="Parent folder"
          disabled={!listing()?.parent}
          onClick={() => go(listing()?.parent ?? undefined)}
        >
          <ArrowUpIcon />
        </IconButton>
        {/* rtl so a long path is cut at the start; bdi keeps its slashes in order. */}
        <span class="min-w-0 flex-1 truncate text-left font-mono text-meta text-muted [direction:rtl]">
          <bdi>{listing()?.path}</bdi>
        </span>
      </div>
      <Show when={error()}>
        <Alert class="mx-2 mt-2">{error()}</Alert>
      </Show>
      <OptionList inset={2} class="flex-1">
        <For
          each={listing()?.dirs}
          keyed={(d) => d.path}
          fallback={
            <Show when={listing()}>
              <NoMatches>No folders here</NoMatches>
            </Show>
          }
        >
          {(d) => (
            <button
              type="button"
              class={[optionClass, 'text-muted hover:text-fg']}
              onClick={() => go(d().path)}
            >
              <FolderIcon />
              <span class="flex-1 truncate">{d().name}</span>
              <Show when={d().git}>
                <Tag tone="neutral">git</Tag>
              </Show>
            </button>
          )}
        </For>
      </OptionList>
    </Dialog>
  );
}
