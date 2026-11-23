import type { ReactNode } from 'react';
import {
  RiArrowRightSLine,
  RiLayoutRightLine,
  RiMenuLine,
} from '@remixicon/react';
import { IconButton } from '@/components/base/buttons/icon-button';
import { cx } from '@/utils/cx';
import { panel } from './panel';
import { SidePanel } from './SidePanel';
import { useUi } from './ui';

/**
 * The centre card, after BoardUI's AI Chat template: a rounded secondary
 * surface whose header is only a breadcrumb and a few actions, with the side
 * panel flat on the page beside it. Each column folds itself from its own
 * header, so the centre carries no toggles on a wide screen.
 */
export function Page({
  title,
  crumb,
  badge,
  actions,
  workspace,
  children,
  bodyClassName,
}: {
  title: ReactNode;
  /** The parent before the title, such as the workspace. */
  crumb?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  /** Shows the side panel for this workspace. */
  workspace?: string;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const ui = useUi();
  return (
    <>
      <section
        className={cx(
          panel,
          'relative flex h-full min-w-0 flex-1 flex-col overflow-hidden',
        )}
      >
        <header className="flex h-12 shrink-0 items-center gap-2 px-3 sm:px-4">
          <IconButton
            icon={RiMenuLine}
            size="small"
            aria-label="Open sidebar"
            onClick={() => ui.setNav(true)}
            className="lg:hidden"
          />
          <nav
            aria-label="Location"
            className="flex min-w-0 flex-1 items-center gap-1 text-body-2-medium"
          >
            {crumb && (
              <>
                <span className="hidden min-w-0 shrink truncate text-text-tertiary sm:block">
                  {crumb}
                </span>
                <RiArrowRightSLine
                  aria-hidden
                  className="hidden size-4 shrink-0 text-foreground-icon-tertiary sm:block"
                />
              </>
            )}
            <h1 className="min-w-0 truncate text-text-primary">{title}</h1>
            {badge && <span className="ms-1 shrink-0">{badge}</span>}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            {workspace && (
              <IconButton
                icon={RiLayoutRightLine}
                size="small"
                aria-label="Open side panel"
                onClick={() => ui.setPanel(true)}
                className="xl:hidden"
              />
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
            collapsed={ui.panelCollapsed}
            className="hidden xl:flex"
          />
          {ui.panel && (
            <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
              <button
                type="button"
                aria-label="Close side panel"
                onClick={() => ui.setPanel(false)}
                className="absolute inset-0 cursor-pointer bg-black/40"
              />
              <div className="relative flex h-full w-[min(380px,calc(100vw-32px))] p-1.5">
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
