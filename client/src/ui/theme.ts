import { storageKey, stored } from './stored';

export type Theme = 'system' | 'light' | 'dark';

const KEY = 'theme';
const BG = { light: '#fbfbfa', dark: '#1c1c20' };

const [theme, save] = stored<Theme>(KEY, 'system', ['system', 'light', 'dark']);
export { theme };

export function setTheme(t: Theme) {
  save(t);
  apply(t);
}

// Everything themes through `color-scheme` (our light-dark() tokens, Shiki,
// Pierre's shadow roots), so one attribute switches it all.
function apply(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') delete root.dataset.theme;
  else root.dataset.theme = t;
  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    const own = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = BG[t === 'system' ? own : t];
  }
}

/** Runs inline in <head> before first paint, so a forced theme doesn't flash. */
export const themeBootScript = `try{var t=localStorage.getItem('${storageKey(KEY)}');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;var c=t==='dark'?'${BG.dark}':'${BG.light}';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=c})}}catch(e){}`;
