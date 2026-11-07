import type { ReactNode } from 'react';
import { RiLayoutRightLine, RiMenuLine, RiSideBarFill } from '@remixicon/react';
import { IconButton } from '@/components/base/buttons/icon-button';
import { cx } from '@/utils/cx';
import { SidePanel } from './SidePanel';
import { useUi } from './ui';

/**
 * The centre card, after BoardUI's chat screen: a rounded secondary surface
 * with a 48px header, and the side panel as a card of its own beside it.
 */
export function Page({
  title,
  subtitle,
  actions,
  workspace,
  children,
  bodyClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Shows the side panel for this workspace. */
  workspace?: string;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const ui = useUi();
  return (
    <>
      <section className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-background-secondary-default">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-separator-border px-3 sm:px-4">
          <IconButton
            icon={RiMenuLine}
            size="small"
            aria-label="Open sidebar"
            onClick={() => ui.setNav(true)}
            className="lg:hidden"
          />
          {ui.sidebarHidden && (
            <IconButton
              icon={RiSideBarFill}
              size="small"
              aria-label="Show sidebar"
              onClick={() => ui.setSidebarHidden(false)}
              className="hidden lg:flex"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-headline-medium text-text-primary">
              {title}
            </h1>
            {subtitle && (
              <div className="flex min-w-0 items-center gap-1.5 truncate text-caption-1-medium text-text-tertiary">
                {subtitle}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {actions}
            {workspace && (
              <>
                <IconButton
                  icon={RiLayoutRightLine}
                  size="small"
                  aria-label="Open side panel"
                  onClick={() => ui.setPanel(true)}
                  className="xl:hidden"
                />
                <IconButton
                  icon={RiLayoutRightLine}
                  size="small"
                  aria-label={
                    ui.panelHidden ? 'Show side panel' : 'Hide side panel'
                  }
                  onClick={() => ui.setPanelHidden(!ui.panelHidden)}
                  className="hidden xl:flex"
                />
              </>
            )}
          </div>
        </header>
        <div className={cx('relative min-h-0 flex-1', bodyClassName)}>
          {children}
        </div>
      </section>

      {workspace && (
        <>
          <SidePanel
            workspace={workspace}
            className={cx('hidden', !ui.panelHidden && 'xl:flex')}
          />
          {ui.panel && (
            <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
              <button
                type="button"
                aria-label="Close side panel"
                onClick={() => ui.setPanel(false)}
                className="absolute inset-0 cursor-pointer bg-black/40"
              />
              <div className="relative flex h-full w-[min(380px,calc(100vw-32px))] p-2 sm:p-3">
                <SidePanel
                  workspace={workspace}
                  drawer
                  className="flex w-full"
                />
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
