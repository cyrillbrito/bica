import type { JSX } from '@solidjs/web';

import { Show } from 'solid-js';

import { noPanels, toggleSidePanel, toggleSidebar } from '../ui/layout';
import { IconButton } from '../ui/Button';
import { SidePanelIcon, SidebarIcon } from '../ui/icons';

export default function TopBar(props: {
  children?: JSX.Element;
  // Right-aligned, before the files toggle, e.g. the context meter.
  actions?: JSX.Element;
}) {
  return (
    <header class="flex h-12 shrink-0 items-center gap-1 px-2 pt-[env(safe-area-inset-top)] box-content">
      <IconButton title="Toggle sessions (⌘B)" onClick={toggleSidebar}>
        <SidebarIcon />
      </IconButton>
      <div class="flex min-w-0 flex-1 items-center gap-2 px-1">
        {props.children}
      </div>
      {props.actions}
      <Show when={!noPanels()}>
        <IconButton
          title="Toggle files and changes (⌥⌘B)"
          onClick={toggleSidePanel}
        >
          <SidePanelIcon />
        </IconButton>
      </Show>
    </header>
  );
}
