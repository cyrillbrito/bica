import type { JSX } from '@solidjs/web';
import { For, Match, Show, Switch } from 'solid-js';

import { parseFrontmatter } from './frontmatter';

import { tagClass } from '../ui/Tag';

// Obsidian keeps links in properties as quoted `"[[Note]]"` strings.
export const WIKILINK = /^\[\[([^[\]|]+?)(?:\|([^[\]]+))?\]\]$/;
const URL = /^https?:\/\/\S+$/;
// Deeper nesting than this shows as text: a cut-off beats a runaway layout.
const DEPTH = 3;

function isEmpty(value: unknown) {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0) ||
    (isObject(value) && Object.keys(value).length === 0)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function Empty() {
  return <span class="text-muted italic">Empty</span>;
}

function Text(props: { value: string }) {
  const link = () => WIKILINK.exec(props.value);
  return (
    <Switch fallback={props.value}>
      <Match when={link()}>
        {(link) => (
          <span class="wikilink" title={link()[1]}>
            {link()[2] ?? link()[1]}
          </span>
        )}
      </Match>
      <Match when={URL.test(props.value)}>
        <a href={props.value} class="break-all">
          {props.value}
        </a>
      </Match>
    </Switch>
  );
}

function Chip(props: { value: unknown }) {
  const text = () =>
    typeof props.value === 'string' ? props.value : JSON.stringify(props.value);
  return (
    <span
      class={[tagClass('neutral'), 'max-w-full font-normal']}
      title={text()}
    >
      <span class="truncate">
        <Text value={text()} />
      </span>
    </span>
  );
}

function Value(props: { value: unknown }): JSX.Element {
  return (
    <Switch fallback={<Text value={String(props.value)} />}>
      <Match when={isEmpty(props.value)}>
        <Empty />
      </Match>
      <Match when={typeof props.value === 'boolean'}>
        <input
          type="checkbox"
          checked={props.value as boolean}
          disabled
          aria-label={String(props.value)}
          class="align-[-2px] accent-accent"
        />
      </Match>
      <Match when={Array.isArray(props.value) && (props.value as unknown[])}>
        {(items) => (
          <span class="flex flex-wrap gap-1 py-0.5">
            <For each={items()}>{(item) => <Chip value={item} />}</For>
          </span>
        )}
      </Match>
      <Match when={isObject(props.value) && props.value}>
        {(object) => <Text value={JSON.stringify(object())} />}
      </Match>
    </Switch>
  );
}

// A nested map stacks under its key, so deep levels keep the full width.
function nested(value: unknown, depth: number) {
  return isObject(value) && !isEmpty(value) && depth < DEPTH
    ? value
    : undefined;
}

function Rows(props: { object: Record<string, unknown>; depth: number }) {
  return (
    <dl
      class={[
        'grid grid-cols-[fit-content(min(40%,16rem))_minmax(0,1fr)] gap-x-4 gap-y-1',
        props.depth > 0 && 'border-l border-line pl-3',
      ]}
    >
      <For each={Object.entries(props.object)}>
        {(entry) => (
          <>
            <dt
              class={[
                'truncate text-muted',
                nested(entry[1], props.depth) && 'col-span-2',
              ]}
              title={entry[0]}
            >
              {entry[0]}
            </dt>
            <dd
              class={[
                'min-w-0 break-words whitespace-pre-wrap',
                nested(entry[1], props.depth) && 'col-span-2',
              ]}
            >
              <Show
                when={nested(entry[1], props.depth)}
                fallback={<Value value={entry[1]} />}
              >
                {(object) => <Rows object={object()} depth={props.depth + 1} />}
              </Show>
            </dd>
          </>
        )}
      </For>
    </dl>
  );
}

/**
 * A Markdown file's YAML frontmatter as a list of keys and values, like
 * Obsidian's Properties. YAML that isn't a map of keys shows as written.
 */
export default function Properties(props: { yaml: string }) {
  const data = () => {
    try {
      return parseFrontmatter(props.yaml);
    } catch {
      return undefined;
    }
  };
  return (
    <div class="border-b border-line pb-3.5 font-ui text-ui">
      <Switch fallback={<pre>{props.yaml}</pre>}>
        <Match when={isObject(data()) && (data() as Record<string, unknown>)}>
          {(object) => <Rows object={object()} depth={0} />}
        </Match>
      </Switch>
    </div>
  );
}
