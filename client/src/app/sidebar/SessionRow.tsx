import { Show } from 'solid-js';

import type { SessionSummary } from '@bica/shared/protocol';
import { paths } from '../../router';
import PullRequestBadge from '../../projects/PullRequestBadge';
import StatusDot, { StatusTag } from '../../sessions/StatusDot';
import TitleInput from '../../sessions/TitleInput';
import { createArrival } from '../../ui/arrive';
import { contextMenu, MenuButton } from '../../ui/ContextMenu';
import { MoonIcon, ParentIcon } from '../../ui/icons';
import { Tag } from '../../ui/Tag';
import { age } from '../../ui/time';
import { useSidebar } from './context';

/** A session in the sidebar. Archived rows: no status, muted, and the time they were archived. */
export default function SessionRow(props: {
  session: SessionSummary;
  archived?: boolean;
}) {
  const rows = useSidebar();
  const s = () => props.session;
  const titleRef = createArrival(() => s().title);
  const status = () => rows.statusOf(s());
  return (
    <li
      data-flip={`s:${s().id}`}
      class={[
        'transition-opacity duration-150',
        !props.archived && rows.dimmed(s()) && 'opacity-40',
      ]}
    >
      <Show
        when={rows.renaming() === s().id}
        fallback={
          <div
            class="context-target relative rounded-md"
            {...contextMenu(() => rows.rowMenu(s()))}
          >
            <a
              class={[
                'flex items-center gap-2 rounded-md px-2 py-[3px] transition-colors hover:bg-hover data-active:bg-active touch:py-3 touch:pr-11',
                props.archived && 'text-muted hover:text-fg',
                rows.isSelected(s().id) && 'bg-accent/15! hover:bg-accent/20!',
              ]}
              href={paths.s(s().id)}
              title={
                [s().title, props.archived && rows.whereOf(s())]
                  .filter(Boolean)
                  .join('\n') || undefined
              }
              // Shift would also select the text it passes over.
              onMouseDown={(e) => e.shiftKey && e.preventDefault()}
              onClick={(e) => rows.clickRow(e, s(), props.archived)}
              onDblClick={() => rows.setRenaming(s().id)}
            >
              <Show when={!props.archived}>
                <StatusDot status={status()} />
              </Show>
              {/* dir="auto": a right-to-left title keeps its start, not its end. */}
              <span
                ref={titleRef}
                dir="auto"
                class={[
                  'flex-1 truncate text-left',
                  !props.archived && status() === 'idle' && 'text-muted',
                  !props.archived &&
                    ['done', 'waiting'].includes(status()) &&
                    'font-medium',
                ]}
              >
                {s().title || '…'}
              </span>
              <Show when={!props.archived && s().parent}>
                <span
                  class="text-muted [&_svg]:size-3.5"
                  title="Its parent session is in charge"
                >
                  <ParentIcon />
                </span>
              </Show>
              <Show when={props.archived && s().cleanedUp?.pr}>
                {(pr) => <PullRequestBadge pr={pr()} plain />}
              </Show>
              <Show
                when={!props.archived}
                fallback={
                  <span class="text-meta text-muted tabular-nums">
                    {age(s().archivedAt!)}
                  </span>
                }
              >
                <Show
                  when={s().tonight}
                  fallback={
                    <StatusTag
                      status={status()}
                      since={s().runningSince}
                      updatedAt={s().updatedAt}
                    />
                  }
                >
                  <Tag tone="accent" title="Held for tonight's run">
                    <MoonIcon />
                    Tonight
                  </Tag>
                </Show>
              </Show>
            </a>
            <MenuButton
              class="absolute inset-y-0 right-0.5 my-auto hidden touch:grid"
              items={() => rows.rowMenu(s())}
            />
          </div>
        }
      >
        <div
          class={[
            'flex items-center gap-2 rounded-md bg-active py-0.5 pr-1 touch:py-2',
            props.archived ? 'pl-1' : 'pl-2',
          ]}
        >
          <Show when={!props.archived}>
            <StatusDot status={status()} />
          </Show>
          <TitleInput
            id={s().id}
            value={s().title}
            onClose={() => rows.setRenaming(undefined)}
            class="py-0.5"
          />
        </div>
      </Show>
    </li>
  );
}
