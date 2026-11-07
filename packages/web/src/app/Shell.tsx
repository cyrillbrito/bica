import { useEffect } from 'react';
import { Outlet, useNavigate } from '@tanstack/react-router';
import { DirectionProvider } from '@/components/foundations/direction/direction';
import { CommandPalette } from './CommandPalette';
import { Settings } from './Settings';
import { Sidebar } from './Sidebar';
import { UiProvider, useUi } from './ui';

function Frame() {
  const ui = useUi();
  const navigate = useNavigate();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        ui.setPalette(!ui.palette);
      } else if (key === 'b' && e.altKey) {
        e.preventDefault();
        ui.setPanelCollapsed(!ui.panelCollapsed);
      } else if (key === 'b') {
        e.preventDefault();
        ui.setSidebarCollapsed(!ui.sidebarCollapsed);
      } else if (key === ',') {
        e.preventDefault();
        void navigate({
          to: '.',
          search: (prev) => ({ ...prev, settings: 'general' }),
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui, navigate]);

  return (
    <div className="relative flex h-dvh w-full gap-3 overflow-hidden bg-background-full p-2 sm:p-3">
      <Sidebar collapsed={ui.sidebarCollapsed} className="hidden lg:flex" />

      {/* Below lg the sidebar rides in as a drawer, as in BoardUI's shell. */}
      {ui.nav && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => ui.setNav(false)}
            className="absolute inset-0 cursor-pointer bg-black/40"
          />
          <div className="relative flex h-full max-w-[calc(100vw-48px)] p-2 sm:p-3">
            <Sidebar mobile className="flex" />
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 gap-3">
        <Outlet />
      </div>

      <CommandPalette />
      <Settings />
    </div>
  );
}

export function Shell() {
  return (
    <DirectionProvider locale="en-US">
      <UiProvider>
        <Frame />
      </UiProvider>
    </DirectionProvider>
  );
}
