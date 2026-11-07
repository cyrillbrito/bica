// /: every ported component and block, light and dark side by side. Each
// section renders its content twice, once inside a `.dark` region.
import type { JSX } from '@solidjs/web';
import { For, createSignal } from 'solid-js';

import { ChatScreen } from './blocks/ChatScreen';
import { SettingsModal } from './blocks/SettingsModal';
import { NavItem, Sidebar } from './blocks/Sidebar';
import { StatCards } from './blocks/StatCards';
import {
  Button,
  ButtonGroup,
  ButtonGroupItem,
  IconButton,
  LinkButton,
} from './ui/buttons';
import { Table, TreeView, type TreeNode } from './ui/collections';
import { cx } from './ui/cx';
import {
  Avatar,
  Badge,
  Chip,
  Divider,
  Kbd,
  StatusDot,
  type ChipColor,
} from './ui/display';
import { Input, Textarea } from './ui/fields';
import {
  RiAddLine,
  RiAlignLeft,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiBold,
  RiChatAiLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiEditLine,
  RiFileCodeLine,
  RiGitBranchLine,
  RiHomeLine,
  RiItalic,
  RiLink,
  RiLockLine,
  RiMailLine,
  RiMore2Line,
  RiRobot2Line,
  RiSearchLine,
  RiSettings4Line,
  RiShareLine,
  RiTerminalBoxLine,
} from './ui/icons';
import {
  Dropdown,
  DropdownDivider,
  DropdownGroup,
  DropdownItem,
  Select,
} from './ui/menus';
import { Notification, NotificationViewport, toast } from './ui/Notification';
import { PillTabs, Tabs } from './ui/tabs';
import { Checkbox, Switch } from './ui/toggles';
import { Tooltip } from './ui/Tooltip';

function Section(props: {
  title: string;
  note?: string;
  wide?: boolean;
  children: (dark: boolean) => JSX.Element;
}) {
  return (
    <section class="flex flex-col gap-3">
      <div class="flex items-baseline gap-2 px-1">
        <h2 class="text-title-3-semibold text-text-primary">{props.title}</h2>
        {props.note && (
          <p class="text-body-2-regular text-text-tertiary">{props.note}</p>
        )}
      </div>
      <div
        class={cx(
          'grid gap-3',
          props.wide ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2',
        )}
      >
        <div class="min-w-0 rounded-3xl border border-border-button-default bg-background-full p-4 text-text-primary sm:p-6">
          {props.children(false)}
        </div>
        <div class="dark min-w-0 rounded-3xl border border-border-button-default bg-background-full p-4 text-text-primary sm:p-6">
          {props.children(true)}
        </div>
      </div>
    </section>
  );
}

const Row = (props: { children: JSX.Element; class?: string }) => (
  <div class={cx('flex flex-wrap items-center gap-3', props.class)}>
    {props.children}
  </div>
);

const Label = (props: { children: JSX.Element }) => (
  <p class="text-caption-1-medium text-text-tertiary uppercase tracking-wide">
    {props.children}
  </p>
);

const TREE: TreeNode[] = [
  {
    id: 'client',
    label: 'client',
    children: [
      {
        id: 'src',
        label: 'src',
        children: [
          {
            id: 'ui',
            label: 'ui',
            children: [
              {
                id: 'button',
                label: 'Button.tsx',
                icon: RiFileCodeLine,
                trailing: '+42',
              },
            ],
          },
          { id: 'app', label: 'App.tsx', icon: RiFileCodeLine },
          { id: 'css', label: 'App.css', trailing: 'M' },
        ],
      },
      { id: 'pkg', label: 'package.json' },
    ],
  },
  {
    id: 'server',
    label: 'server',
    children: [{ id: 'srv', label: 'index.ts', icon: RiFileCodeLine }],
  },
  { id: 'readme', label: 'README.md', disabled: true },
];

const CHIP_COLORS: ChipColor[] = [
  'lime',
  'yellow',
  'rose',
  'orange',
  'cyan',
  'blue',
  'purple',
  'neutral',
  'gray',
  'soft',
];

const SESSIONS = [
  {
    title: 'Port BoardUI to Solid',
    who: 'CB',
    status: ['Running', 'lime'],
    model: 'Opus 4.5',
    cost: '$1.84',
  },
  {
    title: 'Fix composer jump on iOS',
    who: 'AL',
    status: ['Waiting', 'yellow'],
    model: 'Sonnet 4.5',
    cost: '$0.42',
  },
  {
    title: 'Flaky socket reconnect test',
    who: 'CB',
    status: ['Failed', 'rose'],
    model: 'GPT-5.4',
    cost: '$0.17',
  },
  {
    title: 'Tree view for kept files',
    who: 'JM',
    status: ['Merged', 'purple'],
    model: 'Opus 4.5',
    cost: '$2.10',
  },
] as const;

export default function Gallery() {
  const [group, setGroup] = createSignal('center');
  const [tab, setTab] = createSignal('transcript');
  const [pill, setPill] = createSignal('all');
  const [pillGray, setPillGray] = createSignal('week');
  const [model, setModel] = createSignal('opus');
  const [settingsLight, setSettingsLight] = createSignal(false);
  const [settingsDark, setSettingsDark] = createSignal(false);

  return (
    <div class="min-h-dvh bg-background-secondary-default">
      <header class="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-separator-border bg-background-full/85 px-4 backdrop-blur-xl sm:px-6">
        <span class="flex size-7 items-center justify-center rounded-lg bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-nav-selected">
          <RiRobot2Line class="size-4" />
        </span>
        <div class="flex min-w-0 flex-col">
          <h1 class="truncate text-headline-semibold text-text-primary">
            BoardUI in Solid 2
          </h1>
          <p class="hidden truncate text-caption-1-regular text-text-tertiary sm:block">
            The free MIT components, ported for a look at Bica in BoardUI's
            style. Light left, dark right.
          </p>
        </div>
        <LinkButton href="/app" trailingIcon={RiArrowRightLine} class="ms-auto">
          Mock Bica
        </LinkButton>
      </header>

      <main class="mx-auto flex max-w-[1400px] flex-col gap-10 px-3 py-6 sm:px-6 sm:py-8">
        <Section
          title="Button"
          note="primary, secondary, ghost, danger · medium, small, xs"
        >
          {() => (
            <div class="flex flex-col gap-4">
              <For each={['medium', 'small', 'xs'] as const}>
                {(size) => (
                  <Row>
                    <Button size={size} leadingIcon={RiAddLine}>
                      New session
                    </Button>
                    <Button
                      size={size}
                      variant="secondary"
                      leadingIcon={RiShareLine}
                    >
                      Share
                    </Button>
                    <Button
                      size={size}
                      variant="ghost"
                      trailingIcon={RiArrowRightSLine}
                    >
                      Continue
                    </Button>
                    <Button
                      size={size}
                      variant="danger"
                      leadingIcon={RiDeleteBinLine}
                    >
                      Archive
                    </Button>
                    <Button
                      size={size}
                      iconOnly
                      leadingIcon={RiAddLine}
                      aria-label="Add"
                    />
                  </Row>
                )}
              </For>
              <Label>Disabled</Label>
              <Row>
                <Button disabled>Primary</Button>
                <Button disabled variant="secondary">
                  Secondary
                </Button>
                <Button disabled variant="ghost">
                  Ghost
                </Button>
                <Button disabled variant="danger">
                  Danger
                </Button>
              </Row>
            </div>
          )}
        </Section>

        <Section title="Icon Button, Button Group, Link Button">
          {() => (
            <div class="flex flex-col gap-5">
              <Row>
                <IconButton icon={RiSettings4Line} aria-label="Settings" />
                <IconButton icon={RiEditLine} aria-label="Edit" />
                <IconButton
                  icon={RiDownloadLine}
                  size="small"
                  aria-label="Download"
                />
                <IconButton icon={RiMore2Line} size="small" aria-label="More" />
                <IconButton
                  icon={RiDeleteBinLine}
                  aria-label="Delete"
                  disabled
                />
              </Row>
              <Row>
                <ButtonGroup aria-label="Alignment">
                  <For each={['left', 'center', 'right']}>
                    {(id) => (
                      <ButtonGroupItem
                        selected={group() === id}
                        onClick={() => setGroup(id)}
                      >
                        {id[0].toUpperCase() + id.slice(1)}
                      </ButtonGroupItem>
                    )}
                  </For>
                </ButtonGroup>
                <ButtonGroup aria-label="Format" class="shadow-none">
                  <ButtonGroupItem
                    size="small"
                    iconOnly
                    leadingIcon={RiBold}
                    aria-label="Bold"
                  />
                  <ButtonGroupItem
                    size="small"
                    iconOnly
                    leadingIcon={RiItalic}
                    aria-label="Italic"
                    selected
                  />
                  <ButtonGroupItem
                    size="small"
                    iconOnly
                    leadingIcon={RiLink}
                    aria-label="Link"
                  />
                  <ButtonGroupItem
                    size="small"
                    disabled
                    leadingIcon={RiAlignLeft}
                  >
                    Align
                  </ButtonGroupItem>
                </ButtonGroup>
              </Row>
              <Row>
                <LinkButton href="#" trailingIcon={RiArrowRightLine}>
                  Open pull request
                </LinkButton>
                <LinkButton variant="secondary" size="small">
                  View diff
                </LinkButton>
                <LinkButton size="xs" leadingIcon={RiGitBranchLine}>
                  boardui-port
                </LinkButton>
                <LinkButton disabled>Disabled</LinkButton>
              </Row>
            </div>
          )}
        </Section>

        <Section
          title="Input and Textarea"
          note="hover, focus, invalid, disabled"
        >
          {() => (
            <div class="grid gap-4 sm:grid-cols-2">
              <Input
                label="Project name"
                placeholder="my-app"
                hint="Shown in the sidebar."
              />
              <Input
                label="Email"
                type="email"
                leadingIcon={RiMailLine}
                placeholder="you@example.com"
                required
                tooltip
              />
              <Input
                label="Branch"
                value="feat/"
                invalid
                hint="A branch named feat/ already exists."
                leadingIcon={RiGitBranchLine}
              />
              <Input
                label="API key"
                placeholder="sk-…"
                disabled
                leadingIcon={RiLockLine}
              />
              <Input
                size="small"
                placeholder="Search sessions"
                leadingIcon={RiSearchLine}
                aria-label="Search sessions"
              />
              <Textarea
                label="Commit message"
                placeholder="Describe the change"
                showCount
                maxLength={72}
                rows={2}
              />
              <Textarea
                label="Prompt"
                value="Grows as you type.\n"
                autoResize
                maxRows={5}
                rows={2}
              />
              <Textarea
                label="Notes"
                invalid
                hint="Too long."
                value="A note"
                rows={2}
              />
            </div>
          )}
        </Section>

        <Section
          title="Select, Dropdown, Tooltip"
          note="Escape closes, arrow keys move"
        >
          {() => (
            <Row class="items-start gap-4">
              <Select
                aria-label="Model"
                value={model()}
                onChange={setModel}
                class="w-48"
                options={[
                  {
                    id: 'opus',
                    label: 'Claude Opus 4.5',
                    leading: <StatusDot color="green" />,
                  },
                  {
                    id: 'sonnet',
                    label: 'Claude Sonnet 4.5',
                    leading: <StatusDot color="yellow" />,
                  },
                  {
                    id: 'gpt',
                    label: 'GPT-5.4',
                    leading: <StatusDot color="indigo" />,
                  },
                  { id: 'old', label: 'Retired model', disabled: true },
                ]}
              />
              <Select
                aria-label="Size"
                size="sm"
                value="sm"
                onChange={() => {}}
                options={[
                  { id: 'sm', label: 'Compact' },
                  { id: 'md', label: 'Comfortable' },
                ]}
              />
              <Select
                aria-label="Disabled"
                disabled
                value="x"
                onChange={() => {}}
                options={[{ id: 'x', label: 'Disabled' }]}
              />
              <Dropdown
                aria-label="Session actions"
                triggerClass="inline-flex h-9 items-center gap-1.5 rounded-2lg border border-border-button-default bg-background-primary-default px-3 text-body-medium text-text-primary shadow-xs hover:bg-background-primary-hover"
                trigger={
                  <>
                    Actions <RiMore2Line class="size-4" />
                  </>
                }
              >
                <DropdownGroup label="Session">
                  <DropdownItem icon={RiEditLine} end={<Kbd>R</Kbd>}>
                    Rename
                  </DropdownItem>
                  <DropdownItem icon={RiGitBranchLine} selected>
                    Fork from here
                  </DropdownItem>
                  <DropdownItem icon={RiShareLine} disabled>
                    Share (soon)
                  </DropdownItem>
                </DropdownGroup>
                <DropdownDivider />
                <DropdownItem
                  icon={RiDeleteBinLine}
                  class="text-text-destructive"
                >
                  Archive
                </DropdownItem>
              </Dropdown>
              <Tooltip content="Small tooltip">
                <Button variant="secondary">Hover me</Button>
              </Tooltip>
              <Tooltip
                size="md"
                content="A medium tooltip can hold a full sentence of help text."
              >
                <IconButton icon={RiTerminalBoxLine} aria-label="Terminal" />
              </Tooltip>
            </Row>
          )}
        </Section>

        <Section title="Checkbox and Switch">
          {() => (
            <div class="flex flex-col gap-4">
              <Row class="gap-5">
                <Checkbox>Unchecked</Checkbox>
                <Checkbox checked>Checked</Checkbox>
                <Checkbox indeterminate>Some</Checkbox>
                <Checkbox disabled>Disabled</Checkbox>
                <Checkbox size="sm" checked>
                  Small
                </Checkbox>
              </Row>
              <Row class="gap-5">
                <Switch size="sm" aria-label="Small" />
                <Switch checked>Sounds</Switch>
                <Switch size="lg" checked aria-label="Large" />
                <Switch disabled>Disabled</Switch>
              </Row>
            </div>
          )}
        </Section>

        <Section title="Tabs" note="underline and pill">
          {() => (
            <div class="flex flex-col gap-5">
              <Tabs
                aria-label="Side panel"
                selected={tab()}
                onSelect={setTab}
                items={[
                  { id: 'transcript', label: 'Transcript', icon: RiChatAiLine },
                  { id: 'files', label: 'Files', count: 12 },
                  { id: 'git', label: 'Git', count: 3, icon: RiGitBranchLine },
                  { id: 'term', label: 'Terminal', disabled: true },
                ]}
              />
              <PillTabs
                aria-label="Filter"
                selected={pill()}
                onSelect={setPill}
                items={[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active', icon: RiRobot2Line },
                  { id: 'archived', label: 'Archived' },
                ]}
              />
              <PillTabs
                aria-label="Range"
                variant="gray"
                selected={pillGray()}
                onSelect={setPillGray}
                items={[
                  { id: 'day', label: 'Day' },
                  { id: 'week', label: 'Week' },
                  { id: 'month', label: 'Month' },
                ]}
              />
            </div>
          )}
        </Section>

        <Section title="Badge, Chip, Status Dot, Kbd, Avatar">
          {() => (
            <div class="flex flex-col gap-4">
              <Row>
                <Badge>152</Badge>
                <Badge color="primary">New</Badge>
                <StatusDot color="green" />
                <StatusDot color="yellow" />
                <StatusDot color="indigo" />
                <Kbd>⌘K</Kbd>
                <Kbd>Esc</Kbd>
              </Row>
              <Row class="gap-2">
                <For each={CHIP_COLORS}>
                  {(c) => <Chip color={c}>{c}</Chip>}
                </For>
              </Row>
              <Row class="gap-2">
                <Chip variant="subtle" color="lime">
                  +5.3%
                </Chip>
                <Chip variant="caption" color="blue">
                  Open #42
                </Chip>
                <Chip variant="caption" color="purple">
                  Merged
                </Chip>
              </Row>
              <Row>
                <Avatar size="xs" initials="C" color="blue" />
                <Avatar size="sm" initials="AL" color="lime" />
                <Avatar size="md" initials="J" color="pink" />
                <Avatar size="lg" initials="M" />
              </Row>
            </div>
          )}
        </Section>

        <Section title="Divider">
          {() => (
            <div class="flex flex-col gap-4">
              <Divider />
              <Divider>Today</Divider>
              <Divider align="start">Earlier this week</Divider>
              <Divider variant="double">Archived</Divider>
              <Divider variant="fill" align="start">
                3 sessions
              </Divider>
            </div>
          )}
        </Section>

        <Section title="Notification">
          {() => (
            <div class="flex flex-col gap-3">
              <Notification
                status="success"
                title="Session finished"
                timestamp="now"
                description="Port BoardUI to Solid stopped running."
              />
              <Notification
                status="error"
                title="Run failed"
                description="bun test exited with code 1."
                actions={[{ label: 'Open' }, { label: 'Retry' }]}
              />
              <Notification
                avatar={{ initials: 'AL', color: 'lime', presence: 'online' }}
                title="Fix composer jump on iOS"
                timestamp="2m"
                description="Waiting on your answer: keep the safe-area padding?"
              />
              <Row>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() =>
                    toast({
                      status: 'information',
                      title: 'Pushed boardui-port',
                      description: '3 commits to origin.',
                    })
                  }
                >
                  Show a toast
                </Button>
              </Row>
            </div>
          )}
        </Section>

        <Section title="Table">
          {() => (
            <div class="overflow-hidden rounded-2xl border border-border-table">
              <Table aria-label="Sessions">
                <thead>
                  <tr>
                    <th class="w-8">
                      <Checkbox aria-label="Select all" indeterminate />
                    </th>
                    <th>Session</th>
                    <th>Status</th>
                    <th class="max-sm:hidden">Model</th>
                    <th class="text-end">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={SESSIONS}>
                    {(s, i) => (
                      <tr class="hover:bg-background-primary-hover">
                        <td>
                          <Checkbox
                            aria-label={`Select ${s.title}`}
                            checked={i() < 2}
                          />
                        </td>
                        <td>
                          <span class="flex items-center gap-2">
                            <Avatar
                              size="sm"
                              initials={s.who}
                              color={i() % 2 ? 'lime' : 'blue'}
                            />
                            <span class="truncate">{s.title}</span>
                          </span>
                        </td>
                        <td>
                          <Chip variant="caption" color={s.status[1]}>
                            {s.status[0]}
                          </Chip>
                        </td>
                        <td class="text-text-secondary max-sm:hidden">
                          {s.model}
                        </td>
                        <td class="text-end tabular-nums">{s.cost}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </Table>
            </div>
          )}
        </Section>

        <Section title="Tree View" note="arrows, Enter, guide lines">
          {() => (
            <TreeView
              aria-label="Files"
              items={TREE}
              defaultExpanded={['client', 'src', 'ui']}
              selected="button"
              class="max-w-sm"
            />
          )}
        </Section>

        <Section title="Stat Cards" note="block" wide>
          {() => (
            <div class="flex flex-col gap-4">
              <StatCards />
              <StatCards variant="footer" />
            </div>
          )}
        </Section>

        <Section title="Sidebar and Settings Modal" note="blocks · ⌘L searches">
          {(dark) => {
            const open = () =>
              dark ? setSettingsDark(true) : setSettingsLight(true);
            return (
              <div class="flex h-[600px] gap-4">
                <Sidebar
                  workspace={{
                    name: 'Acme Inc',
                    initials: 'A',
                    detail: 'Team plan · 8 seats',
                  }}
                  onSettings={open}
                >
                  <nav class="flex w-full flex-col gap-1 px-0.5">
                    <NavItem
                      icon={RiHomeLine}
                      label="Home"
                      badge={152}
                      selected
                    />
                    <NavItem icon={RiChatAiLine} label="AI Chat" />
                    <NavItem icon={RiRobot2Line} label="Agents" badge={3} />
                    <NavItem icon={RiGitBranchLine} label="Branches" />
                    <NavItem icon={RiTerminalBoxLine} label="Terminals" />
                  </nav>
                </Sidebar>
                <div class="hidden flex-1 flex-col items-start gap-3 sm:flex">
                  <p class="text-body-regular text-text-secondary">
                    Settings opens from the sidebar, or here:
                  </p>
                  <Button
                    variant="secondary"
                    leadingIcon={RiSettings4Line}
                    onClick={open}
                  >
                    Open settings
                  </Button>
                </div>
              </div>
            );
          }}
        </Section>

        <Section
          title="Chat screen"
          note="BoardUI's free chat starter, scripted"
          wide
        >
          {() => <ChatScreen class="h-[680px] rounded-2xl" />}
        </Section>
      </main>

      <SettingsModal
        open={settingsLight()}
        onClose={() => setSettingsLight(false)}
      />
      <div class="dark">
        <SettingsModal
          open={settingsDark()}
          onClose={() => setSettingsDark(false)}
        />
      </div>
      <NotificationViewport />
    </div>
  );
}
