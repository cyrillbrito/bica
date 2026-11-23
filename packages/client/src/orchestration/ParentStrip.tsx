import { Show } from 'solid-js';

import type { Bot, SessionSummary } from '@bica/shared/protocol';
import BotMark from '../bots/BotMark';
import { paths } from '../router';
import { Button } from '../ui/Button';
import { DetachIcon, ParentIcon } from '../ui/icons';
import { Strip } from '../ui/Strip';

/**
 * A line above a child session's composer, or a terminal a session started: a
 * link to its parent, and Detach, which makes it yours for good. The parent's
 * title stays out of sentences, since titles run long. A bot's session shows
 * as the bot, linking to its page.
 */
export default function ParentStrip(props: {
  parent: SessionSummary | undefined;
  /** The bot whose session the parent is. */
  bot?: Pick<Bot, 'id' | 'name' | 'color'>;
  onDetach: () => void;
  /** What Detach does, on hover. */
  detachTitle?: string;
}) {
  return (
    <Strip
      tone="accent"
      icon={<ParentIcon />}
      label="Parent in charge"
      action={
        <Button
          size="sm"
          variant="outline"
          title={
            props.detachTitle ??
            "Take it from its parent: it's yours, and the parent hears no more of it"
          }
          onClick={() => props.onDetach()}
        >
          <DetachIcon />
          Detach
        </Button>
      }
    >
      <Show
        when={props.bot}
        fallback={
          <a
            class="min-w-0 truncate text-muted transition-colors hover:text-fg"
            href={props.parent ? paths.s(props.parent.id)() : undefined}
            title={
              props.parent?.title ? `Open ${props.parent.title}` : undefined
            }
          >
            {props.parent?.title || 'Untitled session'}
          </a>
        }
      >
        {(bot) => (
          <a
            class="flex min-w-0 items-center gap-1 text-muted transition-colors hover:text-fg"
            href={
              props.parent ? paths.s(props.parent.id)() : paths.b(bot().id)()
            }
            title={`Open ${bot().name}`}
          >
            <BotMark bot={bot()} />
            <span class="truncate">{bot().name}</span>
          </a>
        )}
      </Show>
    </Strip>
  );
}
