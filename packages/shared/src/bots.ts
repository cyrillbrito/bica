// A bot's color, picked when it is made. Each name is a UI token,
// `--color-bot-<name>`, so the browser maps it to the theme.
export const BOT_COLORS = [
  'blue',
  'teal',
  'green',
  'olive',
  'amber',
  'rose',
  'plum',
  'slate',
] as const;

export type BotColor = (typeof BOT_COLORS)[number];

export function isBotColor(value: unknown): value is BotColor {
  return BOT_COLORS.includes(value as BotColor);
}
