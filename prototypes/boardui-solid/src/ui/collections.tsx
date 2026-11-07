// Ports of BoardUI's table/table.tsx and tree-view/tree-view.tsx (MIT).
// React Aria's Table and Tree collections became plain elements. The table is
// styled by `.bui-table` in globals.css, as in BoardUI. The tree keeps the
// treeitem keyboard pattern (↑ ↓ move, → opens or steps in, ← closes or steps
// out, Enter selects) and its guide lines; Framer Motion's height animation is
// left out.
import type { JSX } from '@solidjs/web';
import { For, Show, createSignal } from 'solid-js';

import { cx } from './cx';
import { Glyph, type IconComponent } from './icon';
import {
  RiArrowRightSLine,
  RiFileLine,
  RiFolder3Line,
  RiFolderOpenLine,
} from './icons';
import { MENU_ITEM_ACTIVE } from './menus';

/* ------------------------------------------------------------------ Table */

export function Table(props: {
  size?: 'sm' | 'md';
  class?: string;
  'aria-label'?: string;
  children: JSX.Element;
}) {
  return (
    <div class={cx('w-full overflow-x-auto', props.class)}>
      <table
        aria-label={props['aria-label']}
        class={cx('bui-table', props.size === 'sm' && 'bui-table-sm')}
      >
        {props.children}
      </table>
    </div>
  );
}

/* --------------------------------------------------------------- TreeView */

export type TreeNode = {
  id: string;
  label: string;
  icon?: IconComponent;
  trailing?: JSX.Element;
  disabled?: boolean;
  children?: TreeNode[];
};

/** `axis` is where the guide line of a depth sits, matching the rows' indent. */
const axis = (depth: number) => `calc(1.125rem + ${depth} * 1.25rem)`;

export function TreeView(props: {
  items: TreeNode[];
  size?: 'sm' | 'md';
  showGuides?: boolean;
  defaultExpanded?: string[];
  selected?: string;
  onSelect?: (id: string) => void;
  'aria-label': string;
  class?: string;
}) {
  const [expanded, setExpanded] = createSignal(
    new Set(props.defaultExpanded ?? []),
  );
  const [selected, setSelected] = createSignal(() => props.selected);
  const toggle = (id: string, open?: boolean) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  const select = (id: string) => {
    setSelected(id);
    props.onSelect?.(id);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const tree = e.currentTarget as HTMLElement;
    const row = (e.target as HTMLElement).closest<HTMLElement>(
      '[role=treeitem]',
    );
    if (!row) return;
    const rows = [...tree.querySelectorAll<HTMLElement>('[role=treeitem]')];
    const at = rows.indexOf(row);
    const id = row.dataset.id!;
    const isOpen = row.getAttribute('aria-expanded') === 'true';
    const hasChildren = row.hasAttribute('aria-expanded');
    const level = Number(row.getAttribute('aria-level'));
    const focus = (el?: HTMLElement) => {
      if (!el) return;
      e.preventDefault();
      el.focus();
    };
    if (e.key === 'ArrowDown') focus(rows[at + 1]);
    else if (e.key === 'ArrowUp') focus(rows[at - 1]);
    else if (e.key === 'Home') focus(rows[0]);
    else if (e.key === 'End') focus(rows.at(-1));
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (hasChildren && !isOpen) toggle(id, true);
      else if (isOpen) focus(rows[at + 1]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isOpen) toggle(id, false);
      else
        focus(
          rows
            .slice(0, at)
            .findLast((r) => Number(r.getAttribute('aria-level')) < level),
        );
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(id);
      if (hasChildren) toggle(id);
    }
  };

  const Rows = (p: {
    nodes: TreeNode[];
    level: number;
    continuing: number[];
  }): JSX.Element => (
    <For each={p.nodes}>
      {(node, i) => {
        const hasChildren = () => !!node.children?.length;
        const isOpen = () => expanded().has(node.id);
        const isLast = () => i() === p.nodes.length - 1;
        const branch = () => (hasChildren() ? 12 : 16);
        return (
          <>
            <div
              role="treeitem"
              data-id={node.id}
              aria-level={p.level}
              aria-expanded={hasChildren() && (isOpen() ? 'true' : 'false')}
              aria-selected={selected() === node.id ? 'true' : 'false'}
              aria-disabled={node.disabled && 'true'}
              tabindex={(selected() ?? props.items[0]?.id) === node.id ? 0 : -1}
              onClick={() => {
                if (node.disabled) return;
                select(node.id);
                if (hasChildren()) toggle(node.id);
              }}
              style={{
                'padding-inline-start': `calc(0.5rem + ${p.level - 1} * 1.25rem)`,
              }}
              class={cx(
                'relative flex min-h-9 min-w-0 cursor-pointer items-center gap-2 rounded-xl pe-2 text-body-regular text-text-primary outline-none',
                'transition-[background-color,color,box-shadow] duration-150 motion-reduce:transition-none',
                'group-data-[size=sm]/tree-view:min-h-8 group-data-[size=sm]/tree-view:text-body-2-regular',
                !node.disabled && 'hover:bg-dropdown-item-hover-background',
                selected() === node.id && MENU_ITEM_ACTIVE,
                'focus-visible:bg-dropdown-item-hover-background focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring',
                node.disabled && 'cursor-default text-text-placeholder',
              )}
            >
              {/* Guides: trunks for ancestors that continue below, a curved
                  branch into this row, and a bridge down to open children. */}
              <span
                aria-hidden="true"
                class="pointer-events-none absolute inset-0 text-foreground-icon-quaternary group-data-[guides=false]/tree-view:hidden"
              >
                <For each={p.continuing}>
                  {(depth) => (
                    <span
                      class="absolute -inset-y-px w-px bg-current"
                      style={{ 'inset-inline-start': axis(depth) }}
                    />
                  )}
                </For>
                <Show when={p.level > 1}>
                  <span
                    class="absolute -inset-y-px"
                    style={{
                      'inset-inline-start': axis(p.level - 2),
                      width: `${branch()}px`,
                    }}
                  >
                    <span
                      class="absolute start-0 top-0 w-px bg-current"
                      style={{ bottom: 'calc(50% + 6px)' }}
                    />
                    <svg
                      width={branch()}
                      height="7"
                      viewBox={`0 0 ${branch()} 7`}
                      fill="none"
                      class="absolute start-0"
                      style={{ top: 'calc(50% - 6px)' }}
                    >
                      <path
                        d={`M0.5 0 Q0.5 6 6.5 6 H${branch() - 0.5}`}
                        stroke="currentColor"
                        stroke-width="1"
                      />
                    </svg>
                    <Show when={!isLast()}>
                      <span
                        class="absolute start-0 bottom-0 w-px bg-current"
                        style={{ top: 'calc(50% - 6px)' }}
                      />
                    </Show>
                  </span>
                </Show>
                <Show when={hasChildren() && isOpen()}>
                  <span
                    class="absolute -bottom-px w-px bg-current"
                    style={{
                      'inset-inline-start': axis(p.level - 1),
                      top: 'calc(50% + 8px)',
                    }}
                  />
                </Show>
              </span>
              <span class="flex shrink-0 items-center gap-1">
                <Show
                  when={hasChildren()}
                  fallback={
                    <span
                      aria-hidden="true"
                      class={cx('h-5 shrink-0', p.level > 1 ? 'w-2' : 'w-5')}
                    />
                  }
                >
                  <span class="flex size-5 shrink-0 items-center justify-center rounded-md text-foreground-icon-tertiary">
                    <RiArrowRightSLine
                      class={cx(
                        'size-4 opacity-50 transition-transform duration-150 motion-reduce:transition-none',
                        isOpen() && 'rotate-90',
                      )}
                    />
                  </span>
                </Show>
                <Glyph
                  of={
                    node.icon ??
                    (hasChildren()
                      ? isOpen()
                        ? RiFolderOpenLine
                        : RiFolder3Line
                      : RiFileLine)
                  }
                  class={cx(
                    'size-4 shrink-0 opacity-50',
                    hasChildren()
                      ? 'text-foreground-icon-primary'
                      : 'text-foreground-icon-secondary',
                  )}
                />
              </span>
              <span class="min-w-0 flex-1 truncate text-start">
                {node.label}
              </span>
              <Show when={node.trailing}>
                <span class="ms-auto shrink-0 text-caption-1-regular text-text-tertiary">
                  {node.trailing}
                </span>
              </Show>
            </div>
            <Show when={hasChildren() && isOpen()}>
              <div role="group" class="flex flex-col gap-0.5 pt-0.5">
                <Rows
                  nodes={node.children!}
                  level={p.level + 1}
                  continuing={[
                    ...p.continuing,
                    ...(p.level > 1 && !isLast() ? [p.level - 2] : []),
                  ]}
                />
              </div>
            </Show>
          </>
        );
      }}
    </For>
  );

  return (
    <div
      role="tree"
      aria-label={props['aria-label']}
      data-size={props.size ?? 'md'}
      data-guides={props.showGuides ?? true}
      onKeyDown={onKeyDown}
      class={cx(
        'group/tree-view flex w-full min-w-0 flex-col gap-0.5 rounded-3xl border border-border-button-default bg-background-primary-default p-2 outline-none',
        props.class,
      )}
    >
      <Rows nodes={props.items} level={1} continuing={[]} />
    </div>
  );
}
