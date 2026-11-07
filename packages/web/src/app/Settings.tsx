import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  RiAddLine,
  RiCloseLine,
  RiKeyboardLine,
  RiPlugLine,
  RiSettings6Line,
  RiSparklingLine,
  type RemixiconComponentType,
} from '@remixicon/react';
import {
  SettingsCard,
  SettingsRow,
  SettingsSectionLabel,
} from '@/components/application/settings/settings-rows';
import { ThemeToggle } from '@/components/application/theme/theme-toggle';
import { Button } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import { Kbd } from '@/components/base/kbd/kbd';
import { Select, SelectItem } from '@/components/base/select/select';
import { Switch } from '@/components/base/switch/switch';
import { useDirection } from '@/components/foundations/direction/direction';
import { MODELS, PROVIDERS } from '@/fixtures';
import type { SettingsPage } from '@/router';
import { cx } from '@/utils/cx';

type Icon = RemixiconComponentType;

const PAGES: { id: SettingsPage; label: string; icon: Icon }[] = [
  { id: 'general', label: 'General', icon: RiSettings6Line },
  { id: 'providers', label: 'Providers', icon: RiPlugLine },
  { id: 'models', label: 'Models', icon: RiSparklingLine },
  { id: 'shortcuts', label: 'Shortcuts', icon: RiKeyboardLine },
];

function General() {
  return (
    <div className="flex flex-col gap-2">
      <SettingsSectionLabel>Appearance</SettingsSectionLabel>
      <SettingsCard>
        <SettingsRow label="Theme" description="Light or dark, on this device">
          <ThemeToggle appearance="segmented" size="small" />
        </SettingsRow>
        <SettingsRow
          label="Hide thinking"
          description="Leave the agent's thinking out of transcripts"
        >
          <Switch aria-label="Hide thinking" />
        </SettingsRow>
      </SettingsCard>
      <SettingsSectionLabel className="pt-3">Git</SettingsSectionLabel>
      <SettingsCard>
        <SettingsRow
          label="Stage on view"
          description="Opening a diff stages its file"
        >
          <Switch aria-label="Stage on view" defaultSelected />
        </SettingsRow>
        <SettingsRow
          label="Remove finished worktrees"
          description="Merged and idle for a day, or unused for a week"
        >
          <Switch aria-label="Remove finished worktrees" defaultSelected />
        </SettingsRow>
      </SettingsCard>
      <SettingsSectionLabel className="pt-3">
        Notifications
      </SettingsSectionLabel>
      <SettingsCard>
        <SettingsRow
          label="When a session needs you"
          description="A question, a failure, or a finished run"
        >
          <Switch aria-label="When a session needs you" defaultSelected />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}

const STATE_CHIP = {
  connected: { color: 'lime', label: 'Connected' },
  expired: { color: 'rose', label: 'Sign in again' },
  off: { color: 'neutral', label: 'Not connected' },
} as const;

function Providers() {
  return (
    <div className="flex flex-col gap-2">
      <SettingsSectionLabel>Signed in</SettingsSectionLabel>
      <SettingsCard>
        {PROVIDERS.map((p) => (
          <div
            key={p.id}
            className="flex min-h-[52px] items-center gap-3 border-b border-separator-border py-2.5 pe-2.5 last:border-b-0"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-primary-default text-body-semibold text-text-primary shadow-xs">
              {p.name[0]}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-regular text-text-primary">
                {p.name}
              </span>
              <span className="truncate text-body-2-regular text-text-secondary">
                {p.account ?? (p.kind === 'key' ? 'API key' : 'Plan')}
                {p.usage !== undefined && ` · ${p.usage}% used`}
              </span>
            </div>
            <Chip variant="caption" color={STATE_CHIP[p.state].color}>
              {STATE_CHIP[p.state].label}
            </Chip>
            <Button variant="secondary" size="small" className="hidden sm:flex">
              {p.state === 'connected' ? 'Manage' : 'Sign in'}
            </Button>
          </div>
        ))}
      </SettingsCard>
      <div className="flex justify-end pt-2">
        <Button variant="primary" size="small" leadingIcon={RiAddLine}>
          Add provider
        </Button>
      </div>
    </div>
  );
}

function ModelSelect({ label, initial }: { label: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Select
      aria-label={label}
      selectedKey={value}
      onSelectionChange={(key) => setValue(String(key))}
      size="sm"
      className="w-44"
    >
      {MODELS.map((m) => (
        <SelectItem key={m.id} id={m.id} textValue={m.name}>
          {m.name}
        </SelectItem>
      ))}
    </Select>
  );
}

function Models() {
  return (
    <div className="flex flex-col gap-2">
      <SettingsSectionLabel>Which model does what</SettingsSectionLabel>
      <SettingsCard>
        <SettingsRow label="Default model" description="Starts new sessions">
          <ModelSelect label="Default model" initial="claude-opus" />
        </SettingsRow>
        <SettingsRow
          label="Fast model"
          description="Names sessions and writes commit messages"
        >
          <ModelSelect label="Fast model" initial="claude-haiku" />
        </SettingsRow>
      </SettingsCard>
      <SettingsSectionLabel className="pt-3">Model picker</SettingsSectionLabel>
      <SettingsCard>
        {MODELS.map((m) => (
          <SettingsRow
            key={m.id}
            label={m.name}
            description={`${m.provider} · ${m.context} context · ${m.price} per million`}
          >
            <Switch aria-label={`Offer ${m.name}`} defaultSelected />
          </SettingsRow>
        ))}
      </SettingsCard>
    </div>
  );
}

const SHORTCUTS = [
  ['Command palette', '⌘K'],
  ['Show or hide the sidebar', '⌘B'],
  ['Show or hide the side panel', '⌥⌘B'],
  ['Settings', '⌘,'],
  ['New session here', '⇧⌘O'],
  ['Next session that needs you', '⌥⇧↓'],
  ['Queue a prompt', '⌘↵'],
];

function Shortcuts() {
  return (
    <SettingsCard>
      {SHORTCUTS.map(([label, keys]) => (
        <SettingsRow key={label} label={label!}>
          <Kbd className="px-1.5">{keys}</Kbd>
        </SettingsRow>
      ))}
    </SettingsCard>
  );
}

/**
 * BoardUI's Settings Modal shell: a rail of pages and a scrolling page, with
 * the fade, blur, and scale on open and close. The page is in the address.
 */
export function Settings() {
  const direction = useDirection();
  const navigate = useNavigate();
  const page = useSearch({ strict: false, select: (s) => s.settings });
  const isOpen = !!page;
  const [shown, setShown] = useState<SettingsPage>('general');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  const close = () =>
    void navigate({
      to: '.',
      search: (prev) => ({ ...prev, settings: undefined }),
    });
  const go = (id: SettingsPage) =>
    void navigate({ to: '.', search: (prev) => ({ ...prev, settings: id }) });

  if (page && page !== shown && PAGES.some((p) => p.id === page))
    setShown(page);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Two frames, so the hidden state paints before the transition starts.
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [isOpen]);

  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!mounted) return null;
  const title = PAGES.find((p) => p.id === shown)!.label;

  return createPortal(
    <div
      dir={direction}
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close settings"
        tabIndex={-1}
        onClick={close}
        className={cx(
          'absolute inset-0 cursor-default bg-black/70 transition-opacity duration-300 ease-out',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className={cx(
          'relative flex h-[614px] max-h-[calc(100dvh-32px)] w-[871px] max-w-[calc(100vw-32px)] overflow-clip rounded-3xl bg-background-full shadow-xs outline-none',
          'transform-gpu transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          visible
            ? 'scale-100 opacity-100 blur-0'
            : 'scale-[0.85] opacity-0 blur-[4px]',
        )}
      >
        <nav
          aria-label="Settings pages"
          className="flex w-14 shrink-0 flex-col gap-1 overflow-y-auto border-e border-separator-border bg-background-secondary-default p-2.5 sm:w-48 lg:w-60"
        >
          <span className="hidden ps-2 pt-1 pb-0.5 text-body-medium text-text-secondary sm:block">
            Settings
          </span>
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={p.label}
              aria-current={p.id === shown ? 'page' : undefined}
              onClick={() => {
                go(p.id);
                setScrolled(false);
              }}
              className={cx(
                'flex w-full cursor-pointer items-center gap-2 rounded-2lg p-2 text-start outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                p.id === shown
                  ? 'bg-background-secondary-hover'
                  : 'hover:bg-background-secondary-hover/60',
              )}
            >
              <p.icon
                aria-hidden
                className="size-5 shrink-0 text-foreground-icon-secondary"
              />
              <span
                className={cx(
                  'hidden truncate text-body-medium sm:block',
                  p.id === shown ? 'text-text-primary' : 'text-text-secondary',
                )}
              >
                {p.label}
              </span>
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between px-5 pt-6 pb-3 sm:px-8 sm:pt-8">
            <h2 className="text-title-3-medium text-text-primary">{title}</h2>
            <button
              type="button"
              aria-label="Close settings"
              onClick={close}
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-background-tertiary-default text-foreground-icon-secondary transition-colors hover:bg-background-tertiary-hover"
            >
              <RiCloseLine aria-hidden className="size-4" />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <div
              className="h-full overflow-y-auto px-5 pb-8 sm:px-8"
              onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
            >
              {shown === 'providers' ? (
                <Providers />
              ) : shown === 'models' ? (
                <Models />
              ) : shown === 'shortcuts' ? (
                <Shortcuts />
              ) : (
                <General />
              )}
            </div>
            <div
              aria-hidden
              className={cx(
                'pointer-events-none absolute inset-x-0 top-0 h-10 bg-linear-to-b from-background-full to-transparent transition-opacity duration-200',
                scrolled ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
