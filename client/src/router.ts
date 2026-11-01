// Its own module so App.tsx and components (typed `paths`) share one instance.
import { pageRoutes } from 'virtual:file-routes';
import { createRouter } from '@solidjs/router';
import { fileRoutes } from '@solidjs/router/fs';

export const Router = createRouter({ routes: fileRoutes(pageRoutes) });

export const { paths } = Router;

/**
 * What a location shows, read from its URL, for code outside the page's own
 * route: the palette, the side panel, the sidebar. Other pages (home, hub,
 * settings) are named by their first segment.
 */
export type Page =
  | { kind: 's' | 't'; id: string }
  | { kind: 'p'; projectId: string; cwd: string | null }
  | { kind: 'other'; name: string };

export function pageOf(l: { pathname: string; search: string }): Page {
  const [, name = '', raw] = l.pathname.split('/');
  const id = raw ? decodeURIComponent(raw) : undefined;
  if ((name === 's' || name === 't') && id) return { kind: name, id };
  if (name === 'p' && id)
    return {
      kind: 'p',
      projectId: id,
      cwd: new URLSearchParams(l.search).get('w'),
    };
  return { kind: 'other', name };
}

/** Whether a location is the workspace page of this folder. */
export function isWorkspacePage(
  l: { pathname: string; search: string },
  projectId: string,
  cwd: string,
) {
  const page = pageOf(l);
  return page.kind === 'p' && page.projectId === projectId && page.cwd === cwd;
}
