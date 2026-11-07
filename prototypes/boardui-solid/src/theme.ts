import { createSignal } from 'solid-js';

// The page theme: BoardUI flips its tokens with a `.dark` class on <html>.
// index.html applies the saved value before first paint.
const [theme, setThemeSignal] = createSignal<'light' | 'dark'>(
  document.documentElement.classList.contains('dark') ? 'dark' : 'light',
);

export { theme };

export function setTheme(next: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', next === 'dark');
  localStorage.setItem('proto.theme', next);
  setThemeSignal(next);
}
