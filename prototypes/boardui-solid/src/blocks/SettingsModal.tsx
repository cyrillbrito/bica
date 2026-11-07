// Port of BoardUI's application/settings/settings-modal.tsx, settings-rows.tsx
// and settings-general.tsx (MIT). The portal + manual focus/Escape handling
// became a native <dialog> (showModal traps focus and closes on Escape). The
// WebGL flag artwork on the plan card is left out. Rows are relabelled with
// Bica settings so the screen reads as ours.
import type { JSX } from '@solidjs/web';
import {
  For,
  Match,
  Show,
  Switch as SwitchFlow,
  createEffect,
  createSignal,
} from 'solid-js';

import { Button } from '../ui/buttons';
import { cx } from '../ui/cx';
import { Glyph, type IconComponent } from '../ui/icon';
import {
  RiBankCardLine,
  RiBookOpenLine,
  RiCloseLine,
  RiCodeBlock,
  RiCupLine,
  RiDatabase2Line,
  RiGitMergeLine,
  RiPaletteLine,
  RiPlugLine,
  RiRobot2Line,
  RiSettings6Line,
  RiTerminalBoxLine,
} from '../ui/icons';
import { Select } from '../ui/menus';
import { PillTabs } from '../ui/tabs';
import { Switch } from '../ui/toggles';

type Page = 'general' | 'appearance' | 'models';

const NAV: {
  label: string;
  items: { label: string; icon: IconComponent; page?: Page }[];
}[] = [
  {
    label: 'Settings',
    items: [
      { label: 'General', icon: RiSettings6Line, page: 'general' },
      { label: 'Models', icon: RiRobot2Line, page: 'models' },
      { label: 'Appearance', icon: RiPaletteLine, page: 'appearance' },
      { label: 'Billing', icon: RiBankCardLine },
      { label: 'Storage', icon: RiDatabase2Line },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Terminals', icon: RiTerminalBoxLine },
      { label: 'Extensions', icon: RiPlugLine },
      { label: 'Developer', icon: RiCodeBlock },
    ],
  },
  {
    label: 'Customize',
    items: [
      { label: 'Skills', icon: RiBookOpenLine },
      { label: 'Git', icon: RiGitMergeLine },
    ],
  },
];

const TITLES: Record<Page, string> = {
  general: 'General',
  appearance: 'Appearance',
  models: 'Models',
};

/* ------------------------------------------------------------------- rows */

export function SettingsCard(props: { class?: string; children: JSX.Element }) {
  return (
    <div
      class={cx(
        'flex w-full flex-col rounded-2xl bg-background-secondary-default ps-3',
        props.class,
      )}
    >
      {props.children}
    </div>
  );
}

export function SettingsSectionLabel(props: { children: JSX.Element }) {
  return (
    <p class="w-full px-3 text-body-2-medium text-text-secondary">
      {props.children}
    </p>
  );
}

export function SettingsRow(props: {
  label: string;
  description?: string;
  children?: JSX.Element;
}) {
  return (
    <div class="flex min-h-[52px] w-full items-center justify-between gap-4 border-b border-separator-border py-2.5 pe-2.5 last:border-b-0">
      <div class="flex min-w-0 flex-col">
        <p class="text-body-regular text-text-primary">{props.label}</p>
        <Show when={props.description}>
          <p class="text-body-2-regular text-text-secondary">
            {props.description}
          </p>
        </Show>
      </div>
      {props.children}
    </div>
  );
}

const SELECT_TRIGGER = 'h-8 w-auto gap-1 rounded-lg px-2 py-1.5';

/* ------------------------------------------------------------------ pages */

function General() {
  const [sound, setSound] = createSignal('chime');
  return (
    <div class="flex w-full flex-col gap-6">
      <div class="relative w-full overflow-hidden rounded-2xl bg-background-secondary-default">
        <div
          aria-hidden="true"
          class="absolute -end-10 -top-10 size-56 rounded-full bg-[radial-gradient(closest-side,var(--color-accent-300),transparent)] opacity-40"
        />
        <div class="relative flex flex-col gap-2.5 py-3 pe-2.5 ps-3">
          <div class="flex flex-col gap-2">
            <span class="inline-flex w-fit items-center rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-body-2-medium text-text-secondary">
              Current plan
            </span>
            <div class="flex flex-col gap-0.5">
              <p class="text-headline-medium text-text-primary">
                Claude Max · 2 accounts
              </p>
              <p class="text-body-2-regular text-text-secondary">
                64% of the weekly limit used. Resets Monday.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="small" class="w-fit">
            Manage accounts
          </Button>
        </div>
      </div>

      <SettingsCard>
        <SettingsRow
          label="Data folder"
          description="Sessions, transcripts, and settings live here"
        >
          <Button variant="secondary" size="small">
            Reveal
          </Button>
        </SettingsRow>
      </SettingsCard>

      <div class="flex w-full flex-col gap-2">
        <SettingsSectionLabel>Pull requests</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow
            label="Review provider"
            description="Where pull requests open"
          >
            <Select
              aria-label="Review provider"
              value="github"
              onChange={() => {}}
              triggerClass={SELECT_TRIGGER}
              options={[
                { id: 'github', label: 'GitHub' },
                { id: 'gitlab', label: 'GitLab' },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Remove merged worktrees"
            description="Clean up a worktree once its branch merges"
          >
            <Switch aria-label="Remove merged worktrees" checked />
          </SettingsRow>
        </SettingsCard>
      </div>

      <div class="flex w-full flex-col gap-2">
        <SettingsSectionLabel>Notifications</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow
            label="Questions"
            description="Notify me when an agent waits on an answer"
          >
            <Switch aria-label="Questions" checked />
          </SettingsRow>
          <SettingsRow
            label="Finished runs"
            description="Notify me when a session stops running"
          >
            <Switch aria-label="Finished runs" />
          </SettingsRow>
          <SettingsRow
            label="Sound"
            description="Played once per change across tabs"
          >
            <Select
              aria-label="Sound"
              value={sound()}
              onChange={setSound}
              triggerClass={SELECT_TRIGGER}
              options={[
                { id: 'chime', label: 'Chime' },
                { id: 'pour', label: 'Pour' },
                { id: 'off', label: 'Off' },
              ]}
            />
          </SettingsRow>
        </SettingsCard>
      </div>
    </div>
  );
}

function Appearance(props: {
  theme: 'light' | 'dark';
  onTheme: (t: 'light' | 'dark') => void;
}) {
  return (
    <div class="flex w-full flex-col gap-6">
      <SettingsCard>
        <SettingsRow label="Theme" description="Per device">
          <PillTabs
            aria-label="Theme"
            variant="gray"
            selected={props.theme}
            onSelect={(id) => props.onTheme(id as 'light' | 'dark')}
            items={[
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Reduced motion"
          description="Keep progress, drop decoration"
        >
          <Switch aria-label="Reduced motion" />
        </SettingsRow>
        <SettingsRow
          label="Coffee moments"
          description="A cup on the working line"
        >
          <span class="flex items-center gap-1 text-body-2-medium text-text-secondary">
            <RiCupLine class="size-4" /> On
          </span>
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}

function Models() {
  const [model, setModel] = createSignal('opus');
  return (
    <div class="flex w-full flex-col gap-6">
      <SettingsCard>
        <SettingsRow
          label="Default model"
          description="New sessions start with this"
        >
          <Select
            aria-label="Default model"
            value={model()}
            onChange={setModel}
            triggerClass={SELECT_TRIGGER}
            options={[
              { id: 'opus', label: 'Claude Opus 4.5' },
              { id: 'sonnet', label: 'Claude Sonnet 4.5' },
              { id: 'gpt', label: 'GPT-5.4' },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Fast model"
          description="Titles and commit messages"
        >
          <Select
            aria-label="Fast model"
            value="haiku"
            onChange={() => {}}
            triggerClass={SELECT_TRIGGER}
            options={[
              { id: 'haiku', label: 'Claude Haiku 4.5' },
              { id: 'mini', label: 'GPT-5.4 mini' },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Web search"
          description="Exa key for the search tool"
        >
          <Switch aria-label="Web search" checked />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}

/* ------------------------------------------------------------------ modal */

export function SettingsModal(props: {
  open: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
  onTheme?: (t: 'light' | 'dark') => void;
}) {
  const [page, setPage] = createSignal<Page>('general');
  const [scrolled, setScrolled] = createSignal(false);
  let dialog!: HTMLDialogElement;

  createEffect(
    () => props.open,
    (open) => {
      if (open && !dialog.open) dialog.showModal();
      if (!open && dialog.open) dialog.close();
    },
  );

  return (
    <dialog
      ref={dialog}
      aria-label="Settings"
      onClose={() => props.onClose()}
      onClick={(e) => e.target === dialog && props.onClose()}
      class="bui-dialog m-auto max-h-none max-w-none overflow-visible bg-transparent p-4 backdrop:bg-black/70"
    >
      <div class="relative flex h-[614px] max-h-[calc(100dvh-32px)] w-[871px] max-w-[calc(100vw-32px)] overflow-clip rounded-3xl bg-background-full shadow-xs outline-none">
        <nav
          aria-label="Settings sections"
          class="flex w-14 shrink-0 flex-col gap-5 overflow-y-auto border-e border-separator-border bg-background-secondary-default p-2.5 sm:w-48 lg:w-60"
        >
          <For each={NAV}>
            {(group) => (
              <div class="flex w-full flex-col gap-1.5 pt-1">
                <span class="hidden ps-2 text-body-medium text-text-secondary sm:block">
                  {group.label}
                </span>
                <div class="flex w-full flex-col gap-1">
                  <For each={group.items}>
                    {(item) => (
                      <button
                        type="button"
                        title={item.label}
                        aria-current={item.page === page() ? 'page' : undefined}
                        onClick={() => {
                          if (!item.page) return;
                          setPage(item.page);
                          setScrolled(false);
                        }}
                        class={cx(
                          'flex w-full cursor-pointer items-center gap-2 rounded-2lg p-2 text-start',
                          'outline-none transition-colors duration-150 ease focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                          item.page === page()
                            ? 'bg-background-secondary-hover'
                            : 'hover:bg-background-secondary-hover/60',
                        )}
                      >
                        <Glyph
                          of={item.icon}
                          class="size-5 shrink-0 text-foreground-icon-secondary"
                        />
                        <span
                          class={cx(
                            'hidden truncate text-body-medium sm:block',
                            item.page === page()
                              ? 'text-text-primary'
                              : 'text-text-secondary',
                          )}
                        >
                          {item.label}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </nav>

        <div class="flex min-w-0 flex-1 flex-col">
          <div class="flex shrink-0 items-center justify-between px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
            <h2 class="text-title-3-medium text-text-primary">
              {TITLES[page()]}
            </h2>
            <button
              type="button"
              aria-label="Close settings"
              onClick={() => props.onClose()}
              class={cx(
                'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full',
                'bg-background-tertiary-default text-foreground-icon-secondary',
                'transition-colors duration-150 ease hover:bg-background-tertiary-hover',
                'outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring',
              )}
            >
              <RiCloseLine class="size-4" />
            </button>
          </div>
          <div class="relative min-h-0 flex-1">
            <div
              class="h-full overflow-y-auto px-5 pb-8 sm:px-8"
              onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
            >
              <SwitchFlow>
                <Match when={page() === 'general'}>
                  <General />
                </Match>
                <Match when={page() === 'appearance'}>
                  <Appearance
                    theme={props.theme ?? 'light'}
                    onTheme={(t) => props.onTheme?.(t)}
                  />
                </Match>
                <Match when={page() === 'models'}>
                  <Models />
                </Match>
              </SwitchFlow>
            </div>
            <div
              aria-hidden="true"
              class={cx(
                'pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-background-full to-transparent',
                'transition-opacity duration-200 ease-out',
                scrolled() ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>
        </div>
      </div>
    </dialog>
  );
}
