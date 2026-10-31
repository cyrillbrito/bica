import { Dynamic, type JSX } from '@solidjs/web';
import { For, Show, createMemo, createSignal } from 'solid-js';

import { CHATS_ID, useProjects, type Target } from './projects';
import type { Project } from '@bica/shared/protocol';
import { useSessions } from '../sessions/sessions';
import { age } from '../ui/time';
import { buttonClass } from '../ui/Button';
import Chevron from '../ui/Chevron';
import { CheckIcon, FolderIcon, PlusIcon, SparkleIcon } from '../ui/icons';
import { NoMatches, optionClass } from '../ui/Option';
import { createActiveOption } from '../ui/listKeys';
import { Popover, PopoverSearch } from '../ui/Popover';

interface Item {
  key: string;
  // Absent: add a project.
  target?: Target;
  label: string;
  icon: () => JSX.Element;
  last?: number;
  muted?: boolean;
}

let nextId = 0;

/** Whether `hay` has every word of the query. */
function matches(hay: string, query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

/**
 * Which project a new session starts in: projects only, the ones used last
 * first, then a chat and adding a project. Where in the project it starts is
 * the switch beside it.
 */
export default function ProjectSelect(props: {
  project: Project;
  onChange: (target: Target) => void;
  onAdd: () => void;
}) {
  const id = `project-select-${++nextId}`;
  let popover: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;
  const projects = useProjects();
  const sessions = useSessions();
  const [query, setQuery] = createSignal('', { name: 'projectQuery' });

  const lastByProject = createMemo(
    () => {
      const map = new Map<string, number>();
      for (const s of sessions())
        if (s.projectId && (map.get(s.projectId) ?? 0) < s.updatedAt)
          map.set(s.projectId, s.updatedAt);
      return map;
    },
    { name: 'projectLast' },
  );

  const items = createMemo(
    (): Item[] => {
      const has = (hay: string) => matches(hay, query());
      const listed = projects()
        .filter((p) => p.id !== CHATS_ID && has(p.name.toLowerCase()))
        .map((p) => ({
          key: p.id,
          target: { projectId: p.id },
          label: p.name,
          icon: FolderIcon,
          last: lastByProject().get(p.id),
        }))
        .sort((a, b) => (b.last ?? 0) - (a.last ?? 0));
      const chats = projects().find((p) => p.id === CHATS_ID);
      const rest: Item[] = [
        ...(chats && has('new chat no project')
          ? [
              {
                key: CHATS_ID,
                target: { projectId: CHATS_ID },
                label: 'New chat, no project',
                icon: SparkleIcon,
              },
            ]
          : []),
        ...(has('add project folder repo')
          ? [{ key: 'add', label: 'Add project…', icon: PlusIcon, muted: true }]
          : []),
      ];
      return [...listed, ...rest];
    },
    { name: 'projectItems' },
  );

  const choose = (i: Item | undefined) => {
    if (!i) return;
    popover?.hidePopover();
    if (i.target) props.onChange(i.target);
    else props.onAdd();
  };

  const nav = createActiveOption({
    id,
    count: () => items().length,
    choose: (i) => choose(items()[i]),
  });

  const isOn = (i: Item) => i.target?.projectId === props.project.id;

  return (
    <>
      <button
        type="button"
        popovertarget={id}
        class={[buttonClass({ size: 'md' }), 'max-w-1/2 min-w-0']}
        style={{ 'anchor-name': `--${id}` }}
        aria-label="Project"
        title={props.project.path}
      >
        <FolderIcon />
        <span class="truncate">
          {props.project.id === CHATS_ID ? 'No project' : props.project.name}
        </span>
        <Chevron class="rotate-90 text-muted/70" />
      </button>
      <Popover
        ref={(el) => (popover = el)}
        id={id}
        label="Project"
        onToggle={(open) => {
          if (!open) return;
          setQuery('');
          if (input) input.value = '';
          nav.move(Math.max(0, items().findIndex(isOn)));
          // On a phone the keyboard would cover the list.
          if (matchMedia('(pointer: fine)').matches) input?.focus();
        }}
      >
        <PopoverSearch
          ref={(el) => (input = el)}
          controls={`${id}-list`}
          activeId={nav.activeId()}
          label="Search projects"
          placeholder="Search projects…"
          onInput={(v) => {
            setQuery(v);
            nav.move(0);
          }}
          onKeyDown={(e) => nav.onKeyDown(e)}
        />
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label="Projects"
          class="flex max-h-[60dvh] flex-col overflow-y-auto overscroll-contain p-1 md:max-h-[min(24rem,60dvh)]"
        >
          <Show when={!items().length}>
            <NoMatches />
          </Show>
          <For each={items()} keyed={(i) => i.key}>
            {(i, n) => {
              const lit = () => nav.active() === n();
              return (
                <div
                  id={nav.optionId(n())}
                  data-active={lit() ? '' : undefined}
                  class={optionClass}
                  role="option"
                  aria-selected={isOn(i()) ? 'true' : 'false'}
                  onPointerMove={() => nav.hover(n())}
                  onClick={() => choose(i())}
                >
                  <span class="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      class={[
                        'grid size-4 shrink-0 place-items-center [&_svg]:size-3.5',
                        lit() ? 'text-fg' : 'text-muted',
                      ]}
                    >
                      <Dynamic component={i().icon} />
                    </span>
                    <span
                      class={['truncate', i().muted && !lit() && 'text-muted']}
                    >
                      {i().label}
                    </span>
                    <Show when={isOn(i())}>
                      <span class="shrink-0 text-accent">
                        <CheckIcon />
                      </span>
                    </Show>
                  </span>
                  <Show when={i().last}>
                    {(t) => (
                      <span class="w-7 shrink-0 text-right text-meta text-muted tabular-nums">
                        {age(t())}
                      </span>
                    )}
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Popover>
    </>
  );
}
