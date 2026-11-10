import { Title } from '@solidjs/meta';
import type { JSX } from '@solidjs/web';
import { For, createSignal, createUniqueId } from 'solid-js';

import TopBar from '../app/TopBar';
import Alert from '../ui/Alert';
import { Button, IconButton } from '../ui/Button';
import { Card, Setting, Toggle } from '../ui/Card';
import { CheckMark } from '../ui/CheckMark';
import { openContextMenu } from '../ui/ContextMenu';
import { CopyButton } from '../ui/CopyButton';
import { Dialog, dialogBody } from '../ui/Dialog';
import Empty from '../ui/Empty';
import { FilterMenu, type FilterValue } from '../ui/FilterMenu';
import { Field, checkKey } from '../ui/Field';
import Input from '../ui/Input';
import Kbd from '../ui/Kbd';
import { NoMatches, OptionGroup, OptionList, optionClass } from '../ui/Option';
import { Popover, PopoverSearch } from '../ui/Popover';
import { ProgressRing } from '../ui/ProgressRing';
import { RollingNumber } from '../ui/RollingNumber';
import { Segmented, SegmentCount, segmentClass } from '../ui/Segmented';
import Select from '../ui/Select';
import { Spinner } from '../ui/Spinner';
import { Strip } from '../ui/Strip';
import { Switch } from '../ui/Switch';
import { Tag, type Tone } from '../ui/Tag';
import TextArea from '../ui/TextArea';
import { ThinkingLoader } from '../ui/ThinkingLoader';
import StatusDot, { STATUS } from '../sessions/StatusDot';
import Working from '../sessions/Working';
import { toast } from '../ui/Toast';
import { Trend } from '../ui/Trend';
import {
  AlertIcon,
  ArchiveIcon,
  CompactIcon,
  CopyIcon,
  FolderIcon,
  MoonIcon,
  PencilIcon,
  PlusIcon,
  PushIcon,
  SearchIcon,
  SparkleIcon,
  ThoughtIcon,
} from '../ui/icons';

// Literal classes, so Tailwind keeps every token's variable.
const COLORS: [string, string][] = [
  ['bg', 'bg-bg'],
  ['panel', 'bg-panel'],
  ['surface', 'bg-surface'],
  ['hover', 'bg-hover'],
  ['active', 'bg-active'],
  ['line', 'bg-line'],
  ['line-strong', 'bg-line-strong'],
  ['muted', 'bg-muted'],
  ['fg', 'bg-fg'],
  ['accent', 'bg-accent'],
  ['running', 'bg-running'],
  ['warn', 'bg-warn'],
  ['danger', 'bg-danger'],
  ['merged', 'bg-merged'],
];
const INKS: [string, string][] = [
  ['accent-ink', 'bg-accent/12 text-accent-ink'],
  ['running-ink', 'bg-running/12 text-running-ink'],
  ['warn-ink', 'bg-warn/15 text-warn-ink'],
  ['danger-ink', 'bg-danger/12 text-danger-ink'],
  ['merged-ink', 'bg-merged/12 text-merged-ink'],
];
const TONES: Tone[] = [
  'neutral',
  'accent',
  'running',
  'warn',
  'danger',
  'merged',
];
const VARIANTS = ['primary', 'soft', 'outline', 'ghost', 'danger'] as const;

/**
 * Every building block in `ui/`, in light and dark side by side, for
 * checking a change by eye or with `agent-browser` (docs/UI.md). Each side
 * pins its own `color-scheme`, so the tokens resolve per side.
 */
export default function Playground() {
  return (
    <>
      <Title>UI</Title>
      <TopBar>
        <h1 class="truncate font-semibold">UI playground</h1>
      </TopBar>
      <div class="grid flex-1 overflow-y-auto overscroll-contain border-t border-line xl:grid-cols-2">
        <Side scheme="light" />
        <Side scheme="dark" />
      </div>
    </>
  );
}

function Side(props: { scheme: 'light' | 'dark' }) {
  return (
    <div
      class="flex min-w-0 flex-col gap-8 bg-bg px-4 py-6 text-fg md:px-8"
      style={{ 'color-scheme': props.scheme }}
    >
      <h2 class="text-display font-semibold capitalize">{props.scheme}</h2>
      <Colors />
      <Type />
      <Buttons />
      <Loading />
      <Fields />
      <Labels />
      <Overlays />
      <Surfaces />
    </div>
  );
}

function Section(props: { title: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-3">
      <h3 class="text-meta font-medium text-muted">{props.title}</h3>
      {props.children}
    </section>
  );
}

function Row(props: { children: JSX.Element }) {
  return <div class="flex flex-wrap items-center gap-2">{props.children}</div>;
}

function Colors() {
  return (
    <Section title="Colors">
      <div class="grid grid-cols-3 gap-2 sm:grid-cols-5">
        <For each={COLORS}>
          {([name, cls]) => (
            <div class="flex flex-col gap-1">
              <span class={['h-10 rounded-md border border-line', cls]} />
              <span class="truncate text-meta text-muted">{name}</span>
            </div>
          )}
        </For>
      </div>
      <Row>
        <For each={INKS}>
          {([name, cls]) => (
            <span class={['rounded-sm px-1.5 text-meta font-medium', cls]}>
              {name}
            </span>
          )}
        </For>
      </Row>
    </Section>
  );
}

function Type() {
  return (
    <Section title="Type">
      <p class="text-display font-semibold">Display, one per screen</p>
      <div class="markdown">
        <p>
          Reading: what the agent writes, in the book face, with{' '}
          <code>inline code</code> and <a href="#type">a link</a>.
        </p>
      </div>
      <p>UI: everything you click or scan.</p>
      <p class="font-mono text-code">code: const bica = 'espresso';</p>
      <p class="text-meta text-muted">Meta: times, counts, hints.</p>
    </Section>
  );
}

function Buttons() {
  return (
    <Section title="Buttons">
      <For each={VARIANTS}>
        {(variant) => (
          <Row>
            <For each={['sm', 'md', 'lg'] as const}>
              {(size) => (
                <Button variant={variant} size={size}>
                  <PlusIcon /> {variant} {size}
                </Button>
              )}
            </For>
            <Button variant={variant} disabled>
              Disabled
            </Button>
          </Row>
        )}
      </For>
      <Row>
        <IconButton title="Edit">
          <PencilIcon />
        </IconButton>
        <IconButton title="Edit" size="md" variant="outline">
          <PencilIcon />
        </IconButton>
        <IconButton title="Push" size="sm" round variant="primary">
          <PushIcon />
        </IconButton>
        <IconButton title="Edit" loading>
          <PencilIcon />
        </IconButton>
        <CopyButton text={() => 'Copied from the playground'} />
        <Button variant="soft">
          Commit <Kbd>⌘↵</Kbd>
        </Button>
      </Row>
    </Section>
  );
}

function Loading() {
  const [busy, setBusy] = createSignal(true, { name: 'playLoading' });
  const [done, setDone] = createSignal(false, { name: 'playDone' });
  const [n, setN] = createSignal(1284, { name: 'playNumber' });
  return (
    <Section title="Loading and busy">
      <Row>
        <Button size="sm" variant="outline" onClick={() => setBusy((b) => !b)}>
          {busy() ? 'Stop' : 'Start'} loading
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDone((d) => !d)}>
          {done() ? 'Run' : 'Finish'} step
        </Button>
        <Button size="sm" variant="outline" onClick={() => setN((v) => v + 37)}>
          Count up
        </Button>
      </Row>
      <Row>
        <Spinner />
        <span class="shimmer">Working on it</span>
        <Button loading={busy()} variant="primary">
          <CompactIcon /> Compact
        </Button>
        <Button loading={busy()} variant="outline">
          Save
        </Button>
        <Button loading={busy()} size="sm">
          <SparkleIcon /> Write
        </Button>
        <IconButton title="Stop" round size="md" loading={busy()}>
          <ArchiveIcon />
        </IconButton>
      </Row>
      <div class="flex h-7 items-center gap-2 px-1.5 text-muted">
        <ThinkingLoader
          label="Thinking"
          done={done()}
          doneLabel="Thought"
          doneIcon={<ThoughtIcon />}
          labelClass="font-medium"
        />
      </div>
      <Working since={Date.now() - 42_000} />
      <Working />
      <Working retry={{ at: Date.now() + 8000, error: 'Overloaded' }} />
      <Row>
        <ProgressRing total={8} done={done() ? 8 : 5} label="5 of 8 done" />
        <RollingNumber value={n()} class="text-display font-semibold" />
        <Trend tone="good">+12% this week</Trend>
        <Trend tone="bad">−3 tests</Trend>
        <Trend tone="neutral">Same</Trend>
      </Row>
    </Section>
  );
}

function Fields() {
  const [key, setKey] = createSignal('sk-ant-short', { name: 'playKey' });
  const [on, setOn] = createSignal(true, { name: 'playSwitch' });
  const [picked, setPicked] = createSignal(true, { name: 'playCheck' });
  const [seg, setSeg] = createSignal('all', { name: 'playSeg' });
  return (
    <Section title="Fields">
      <Input class="h-8" placeholder="Input" aria-label="Input" />
      <Field
        label="API key"
        hint="Saved on the dev machine."
        value={key()}
        onInput={setKey}
        check={checkKey('anthropic', 'Anthropic')}
        touched
      />
      <TextArea
        framed
        rows="3"
        class="max-h-40 px-3 py-2.5"
        placeholder="A text box that grows as you type…"
        aria-label="Text"
      />
      <Row>
        <Select aria-label="Music">
          <option>Low</option>
          <option>High</option>
        </Select>
        <Switch checked={on()} onChange={setOn} label="Switch" />
        <button
          type="button"
          role="checkbox"
          aria-checked={picked() ? 'true' : 'false'}
          class="group/opt flex items-center gap-2"
          onClick={() => setPicked((p) => !p)}
        >
          <CheckMark on={picked()} /> Checkbox
        </button>
        <Segmented>
          <For each={['all', 'needs', 'done']}>
            {(s) => (
              <button
                type="button"
                class={segmentClass}
                data-on={seg() === s ? '' : undefined}
                aria-pressed={seg() === s ? 'true' : 'false'}
                onClick={() => setSeg(s)}
              >
                {s}
                <SegmentCount value={s.length} />
              </button>
            )}
          </For>
        </Segmented>
      </Row>
    </Section>
  );
}

function Labels() {
  return (
    <Section title="Tags, strips, alerts">
      <Row>
        <For each={TONES}>{(t) => <Tag tone={t}>{t}</Tag>}</For>
      </Row>
      <Row>
        <For each={Object.keys(STATUS) as (keyof typeof STATUS)[]}>
          {(s) => (
            <span class="flex items-center gap-1.5 text-meta text-muted">
              <StatusDot status={s} />
              {s}
            </span>
          )}
        </For>
      </Row>
      <div class="rounded-tray bg-panel p-1">
        <Strip
          tone="accent"
          icon={<MoonIcon />}
          label="Runs tonight at 01:00"
        />
        <Strip
          tone="danger"
          icon={<AlertIcon />}
          label="Stuck: its code is gone from Bica"
          action={
            <Button size="sm" variant="outline">
              Stop
            </Button>
          }
        />
      </div>
      <Alert>Push failed: the remote has commits you don't have yet.</Alert>
    </Section>
  );
}

function Overlays() {
  const id = createUniqueId();
  let dialog: HTMLDialogElement | undefined;
  const [query, setQuery] = createSignal('', { name: 'playQuery' });
  const items = () =>
    ['Bica', 'Pi Durable', 'Pierre', 'Solid'].filter((i) =>
      i.toLowerCase().includes(query().toLowerCase()),
    );
  const [filters, setFilters] = createSignal<FilterValue>({});
  return (
    <Section title="Overlays">
      <Row>
        <FilterMenu
          groups={[
            {
              id: 'status',
              label: 'Status',
              options: [
                { id: 'working', label: 'Working', count: 3 },
                { id: 'waiting', label: 'Waiting', count: 1 },
                { id: 'failed', label: 'Failed', count: 0 },
              ],
            },
            {
              id: 'agent',
              label: 'Agent',
              options: [
                { id: 'coding', label: 'Coding' },
                { id: 'assistant', label: 'Assistant' },
              ],
            },
          ]}
          value={filters()}
          onChange={setFilters}
        />
        <Button variant="outline" onClick={() => dialog?.showModal()}>
          Dialog
        </Button>
        <button
          type="button"
          class="flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-muted hover:text-fg"
          popovertarget={id}
          style={{ 'anchor-name': `--${id}` }}
        >
          Popover
        </button>
        <Button
          variant="outline"
          onClick={(e) =>
            openContextMenu(e.clientX, e.clientY, [
              {
                label: 'Copy',
                icon: <CopyIcon />,
                onSelect: () => {},
                keys: '⌘C',
              },
              { label: 'Rename', icon: <PencilIcon />, onSelect: () => {} },
              'separator',
              {
                label: 'Archive',
                icon: <ArchiveIcon />,
                onSelect: () => {},
                danger: true,
              },
            ])
          }
        >
          Menu
        </Button>
        <Button variant="outline" onClick={() => toast('Copied')}>
          Toast
        </Button>
        <Button
          variant="outline"
          onClick={() => toast.error(new Error('Push failed: rejected'))}
        >
          Error toast
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void toast.promise(new Promise((r) => setTimeout(r, 1500)), {
              loading: 'Pushing…',
              success: 'Pushed',
              error: 'Push failed',
            })
          }
        >
          Promise toast
        </Button>
      </Row>
      <Dialog
        ref={(el) => (dialog = el)}
        title="Dialog"
        footer={
          <>
            <Button onClick={() => dialog?.close()}>Cancel</Button>
            <Button variant="primary" onClick={() => dialog?.close()}>
              Done
            </Button>
          </>
        }
      >
        <OptionList inset={2} class={dialogBody}>
          <For each={['One', 'Two', 'Three']}>
            {(i) => (
              <button type="button" class={optionClass}>
                <FolderIcon /> {i}
              </button>
            )}
          </For>
        </OptionList>
      </Dialog>
      <Popover id={id} label="Popover">
        <PopoverSearch label="Search" value={query()} onInput={setQuery} />
        <OptionList class="max-h-72">
          <OptionGroup>Libraries</OptionGroup>
          <For each={items()} fallback={<NoMatches />}>
            {(i) => (
              <button type="button" class={optionClass}>
                <SearchIcon /> {i}
              </button>
            )}
          </For>
        </OptionList>
      </Popover>
    </Section>
  );
}

function Surfaces() {
  const [on, setOn] = createSignal(false, { name: 'playToggle' });
  return (
    <Section title="Surfaces">
      <Card title="Card" description="A tray holding a card of rows.">
        <Setting label="Setting" hint="A control on the right.">
          <Button size="sm" variant="outline">
            Change
          </Button>
        </Setting>
        <Toggle
          label="Toggle"
          hint="The whole row flips it."
          checked={on()}
          onChange={setOn}
        />
      </Card>
      <div class="flex h-56 rounded-card border border-line">
        <Empty
          icon={<FolderIcon />}
          title="No sessions yet"
          action={<Button variant="outline">New session</Button>}
        >
          Start one from the composer.
        </Empty>
      </div>
    </Section>
  );
}
