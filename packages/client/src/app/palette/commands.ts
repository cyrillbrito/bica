import type { JSX } from '@solidjs/web';

// `mod` is ⌘ on a Mac and Ctrl elsewhere; `ctrl` is Ctrl everywhere.
export interface Keys {
  code: string;
  mod?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
}

export interface Command {
  id: string;
  label: string;
  // Muted text after the label, searched too.
  hint?: string;
  // Other words it should be found by: "chat" finds New session.
  words?: string;
  icon?: () => JSX.Element;
  keys?: Keys;
  // Right-aligned, when there are no keys: a session's age.
  meta?: string;
  group?: string;
  run?: () => void;
  page?: () => Page;
}

export interface Page {
  title?: string;
  placeholder: string;
  // Gets the typed text as is; `raw` pages build their rows from it.
  items: (query: string) => Command[];
  raw?: boolean;
}

const KEY_NAMES: Record<string, string> = {
  ArrowDown: '↓',
  Backquote: '`',
  Slash: '/',
};

export function keyLabel(k: Keys) {
  const key = KEY_NAMES[k.code] ?? k.code.replace(/^Key/, '');
  return `${k.ctrl ? '⌃' : ''}${k.alt ? '⌥' : ''}${k.shift ? '⇧' : ''}${k.mod ? '⌘' : ''}${key}`;
}

export function matches(e: KeyboardEvent, k: Keys) {
  return (
    e.code === k.code &&
    (k.mod
      ? e.metaKey || e.ctrlKey
      : k.ctrl
        ? e.ctrlKey && !e.metaKey
        : !e.metaKey && !e.ctrlKey) &&
    !!k.alt === e.altKey &&
    !!k.shift === e.shiftKey
  );
}

function wordStart(t: string, i: number) {
  return i === 0 || !/[\p{L}\p{N}]/u.test(t[i - 1]!);
}

// The word's letters in order from `from`, scored by how many sit together.
function letters(t: string, word: string, from: number) {
  let last = -2;
  let runs = 0;
  for (const ch of word) {
    const i = t.indexOf(ch, from);
    if (i < 0) return 0;
    if (i === last + 1) runs++;
    last = i;
    from = i + 1;
  }
  return 1 + Math.min(runs, 4);
}

// 0: no match. The whole word beats scattered letters, and starting on a word
// beats starting inside one, so the typo "nwe sess" still finds New session.
function score(text: string | undefined, word: string) {
  if (!text) return 0;
  const t = text.toLowerCase();
  const at = t.indexOf(word);
  if (at >= 0) return wordStart(t, at) ? 20 : 10;
  for (let i = t.indexOf(word[0]!); i >= 0; i = t.indexOf(word[0]!, i + 1))
    if (wordStart(t, i)) {
      const s = letters(t, word, i);
      if (s) return s + 4;
      break;
    }
  return letters(t, word, 0);
}

// Every typed word must match somewhere; the label counts double.
function rank(c: Command, words: string[]) {
  let total = 0;
  for (const w of words) {
    const best = Math.max(
      score(c.label, w) * 2,
      score(c.hint, w),
      score(c.words, w),
    );
    if (!best) return 0;
    total += best;
  }
  // On a tie, the shorter label is the closer match.
  return total - c.label.length / 1000;
}

/**
 * A page's rows for what was typed. Typing flattens the groups: the best
 * match goes first, whatever it is.
 */
export function search(page: Page, query: string) {
  const items = page.items(query);
  const q = query.trim().toLowerCase();
  if (!q || page.raw) return items;
  const words = q.split(/\s+/);
  return items
    .map((c) => ({ c, score: rank(c, words) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ ...r.c, group: undefined }));
}
