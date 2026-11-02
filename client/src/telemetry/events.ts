import type { Theme } from '../ui/theme';
import type { PageKind } from './scrub';

type None = Record<string, never>;

/**
 * Every event the browser sends of its own, with its properties
 * (docs/telemetry.md). Values are Bica's own names, never the user's: an
 * action's id, a tab, a setting's name. posthog-js adds `$pageview`,
 * `$pageleave`, `$autocapture`, and the rest itself.
 */
export interface Events {
  // ⌘K, or the sidebar's search button.
  palette_open: None;
  // A row picked in ⌘K: its action's id, such as `a:new-here`, or the kind
  // of row for sessions, workspaces, and terminals.
  command_run: { command: string };
  // An action's shortcut, with the palette closed or open.
  shortcut_use: { shortcut: string };
  side_panel_tab_open: { tab: string };
  // Over a session's chat or on a workspace page.
  file_open: { page_kind: PageKind };
  diff_open: { page_kind: PageKind; view: 'staged' | 'changes' };
  // A setting's name; its value only when it's a switch or a fixed choice.
  setting_change: { setting: string; value?: string };
  theme_change: { theme: Theme };
  dictation_start: None;
}

export type EventName = keyof Events;
