import { paths } from '../router';
import { useTopic } from '../socket/socket';
import { stored } from '../ui/stored';

// Artifacts (docs/artifacts.md): the list, the viewer's picks, and the URLs
// the server serves them at.

export function useArtifacts() {
  return useTopic('artifacts', () => ({}));
}

/** `bica` follows Bica's own light or dark, `light` and `dark` pin one. */
export type ArtifactMode = 'bica' | 'light' | 'dark';

// Per device, like Bica's own theme. An unknown theme falls back to the
// kit's default in the page itself.
export const [artifactTheme, setArtifactTheme] = stored(
  'artifactTheme',
  'bica',
);
export const [artifactMode, setArtifactMode] = stored<ArtifactMode>(
  'artifactMode',
  'bica',
  ['bica', 'light', 'dark'],
);

export function artifactHref(name: string) {
  return paths.artifacts(name)();
}

/** The page itself, sandboxed by the server. */
export function pageUrl(name: string, search: Record<string, string> = {}) {
  const query = new URLSearchParams(search).toString();
  return `/artifact-page/${encodeURIComponent(name)}${query ? `?${query}` : ''}`;
}

/** Whether a path a tool wrote looks like an artifact; the server decides on opening. */
export function looksLikeArtifact(path: string) {
  return /\/artifacts\/[^/]+\.html$/.test(path);
}
