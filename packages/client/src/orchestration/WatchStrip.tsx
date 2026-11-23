import { For, Show } from 'solid-js';

import type { Bot } from '@bica/shared/protocol';
import BotMark from '../bots/BotMark';
import { paths } from '../router';
import { Button } from '../ui/Button';
import { CloseIcon, WatchIcon } from '../ui/icons';
import { Strip } from '../ui/Strip';

/** A session that watches this one; a bot's session shows as the bot. */
export type Watcher = { id: string; name: string; bot?: Bot };

/**
 * A line on the composer's tray of a watched session: each watcher hears
 * every run this one ends (docs/orchestration.md#watching). Stop ends every
 * watch, and each watcher hears so. Past two watchers, the rest are a count.
 */
export default function WatchStrip(props: {
  watchers: Watcher[];
  onStop: () => void;
}) {
  const more = () => props.watchers.length - 2;
  return (
    <Strip
      icon={<WatchIcon />}
      label="Watched by"
      action={
        <Button
          size="sm"
          variant="ghost"
          title="No session hears more of this session's turns"
          onClick={() => props.onStop()}
        >
          <CloseIcon />
          Stop
        </Button>
      }
    >
      <span class="flex min-w-0 items-center gap-2">
        <For each={props.watchers.slice(0, 2)}>
          {(w, i) => (
            // The first gives way to the rest, so a long name can't hide them.
            <a
              class={[
                'flex items-center gap-1 text-muted transition-colors hover:text-fg',
                i() ? 'max-w-24 shrink-0' : 'max-w-40 min-w-0',
              ]}
              href={paths.s(w.id)()}
            >
              <Show when={w.bot}>{(b) => <BotMark bot={b()} />}</Show>
              <span class="truncate">{w.name}</span>
            </a>
          )}
        </For>
        <Show when={more() > 0}>
          <span class="shrink-0 text-muted">and {more()} more</span>
        </Show>
      </span>
    </Strip>
  );
}
