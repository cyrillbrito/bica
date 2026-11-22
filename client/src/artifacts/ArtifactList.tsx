import { For, Show } from 'solid-js';

import Empty from '../ui/Empty';
import { ArtifactIcon } from '../ui/icons';
import { age, clockTime } from '../ui/time';
import { artifactHref, useArtifacts } from './artifacts';

/** Every artifact, newest first: its title, file name, and when it last changed. */
export default function ArtifactList() {
  const artifacts = useArtifacts();
  return (
    <Show
      when={artifacts().list.length}
      fallback={
        <Empty icon={<ArtifactIcon />} title="No artifacts yet">
          Ask an agent for a report or a dashboard, and the page it builds shows
          up here.
        </Empty>
      }
    >
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div class="chat-column pt-2 pb-[max(--spacing(8),env(safe-area-inset-bottom))]">
          <ul class="flex flex-col">
            <For each={artifacts().list} keyed={(a) => a.name}>
              {(a) => (
                <li>
                  <a
                    href={artifactHref(a().name)}
                    class="-mx-2.5 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors hover:bg-hover"
                  >
                    <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-well text-muted">
                      <ArtifactIcon />
                    </span>
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="truncate font-semibold">{a().title}</span>
                      <span class="truncate font-mono text-meta text-muted">
                        {a().name}.html
                      </span>
                    </span>
                    <time
                      class="shrink-0 text-meta text-muted tabular-nums"
                      datetime={new Date(a().updated).toISOString()}
                      title={clockTime(a().updated)}
                    >
                      {age(a().updated)}
                    </time>
                  </a>
                </li>
              )}
            </For>
          </ul>
          <p class="mt-6 text-meta text-muted [overflow-wrap:anywhere]">
            Kept in <span class="font-mono">{artifacts().folder}</span>
          </p>
        </div>
      </div>
    </Show>
  );
}
