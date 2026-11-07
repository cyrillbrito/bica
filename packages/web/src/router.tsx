import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { Shell } from './app/Shell';
import { NotFound } from './app/NotFound';
import { HomePage } from './sessions/HomePage';
import { SessionPage } from './sessions/SessionPage';
import { WorkspacePage } from './files/WorkspacePage';
import { TerminalPage } from './terminals/TerminalPage';

export type SettingsPage = 'general' | 'providers' | 'models' | 'shortcuts';
export type PanelTab = 'files' | 'git';

function text(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

// Settings and the side panel's tab live in the address on every page, so a
// link or a reload opens the same view.
const rootRoute = createRootRoute({
  component: Shell,
  notFoundComponent: NotFound,
  validateSearch: (
    search: Record<string, unknown>,
  ): { settings?: SettingsPage; panel?: PanelTab } => ({
    settings: text(search.settings) as SettingsPage | undefined,
    panel: text(search.panel) as PanelTab | undefined,
  }),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

export const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/s/$id',
  component: SessionPage,
});

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$id',
  component: WorkspacePage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { file?: string; diff?: string } => ({
    file: text(search.file),
    diff: text(search.diff),
  }),
});

export const terminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/t/$id',
  component: TerminalPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  sessionRoute,
  workspaceRoute,
  terminalRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
