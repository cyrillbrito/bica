// How every Pierre view of a file or diff is set up, so a file reads the
// same in the transcript, the workspace page, and Markdown.

/** Pierre's own Shiki themes, light and dark; Markdown's code blocks use them too. */
export const CODE_THEME = {
  light: 'pierre-light',
  dark: 'pierre-dark',
} as const;

/** Below this, two columns of code are too cramped to read. */
const SPLIT_MIN_PX = 560;

/**
 * Tailwind's lg, measured on the view rather than the screen, since the
 * sidebar and side panel take part of it. Narrower views give the line
 * numbers' width to the code.
 */
const LINE_NUMBERS_MIN_PX = 1024;

/** What every view shares; it follows the page's light or dark. */
export const FILE_OPTIONS = {
  theme: CODE_THEME,
  themeType: 'system',
  disableFileHeader: true,
} as const;

/**
 * A diff for a view `width` px wide: side by side when asked and there's
 * room. Whitespace-only changes are left out. Code keeps 6 unchanged lines
 * around each change, 2 more than the default; Markdown keeps 4, since a
 * paragraph is one line that wraps into many.
 */
export function diffOptions(path: string, width: number, split: boolean) {
  return {
    ...FILE_OPTIONS,
    diffStyle: split && width >= SPLIT_MIN_PX ? 'split' : 'unified',
    disableLineNumbers: width < LINE_NUMBERS_MIN_PX,
    parseDiffOptions: {
      ignoreWhitespace: true,
      context: /\.(md|mdx|markdown)$/i.test(path) ? 4 : 6,
    },
  } as const;
}
