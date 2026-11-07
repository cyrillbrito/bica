import { createContext, useContext } from 'solid-js';

import type { SessionStatus, SessionSummary } from '@bica/shared/protocol';
import type { MenuEntry } from '../../ui/ContextMenu';
import type { Target } from '../../projects/projects';
import type { Group } from './groups';

/** What the sidebar's rows share with the list around them. */
export type SidebarRows = {
  /** The status a row shows: the open session reads as seen. */
  statusOf: (s: SessionSummary) => SessionStatus;
  /** Whether a tab being pointed at would leave this row out. */
  dimmed: (s: SessionSummary) => boolean;
  renaming: () => string | undefined;
  setRenaming: (id: string | undefined) => void;
  isSelected: (id: string) => boolean;
  clickRow: (e: MouseEvent, s: SessionSummary, archived?: boolean) => void;
  rowMenu: (s: SessionSummary) => MenuEntry[];
  /** The workspace an archived session ran in. */
  whereOf: (s: SessionSummary) => string | undefined;
  workspaceMenu: (g: Group) => MenuEntry[];
  newSession: (target: Target) => void;
  removeWorkspace: (g: Group) => Promise<void>;
};

export const SidebarContext = createContext<SidebarRows>();

export function useSidebar() {
  return useContext(SidebarContext);
}
