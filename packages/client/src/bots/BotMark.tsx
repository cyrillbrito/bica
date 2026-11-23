import type { Bot } from '@bica/shared/protocol';
import { BOT_SWATCH } from './bots';

const segmenter = new Intl.Segmenter();

/** The first character as a reader sees it, so an emoji or accent stays whole. */
function initial(name: string) {
  const first = segmenter.segment(name.trim()).containing(0)?.segment;
  return first ? first.toLocaleUpperCase() : '?';
}

/**
 * A bot's mark: a tile in its color with its first letter. The one place a
 * bot's color shows (docs/UI.md).
 */
export default function BotMark(props: {
  bot: Pick<Bot, 'name' | 'color'>;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      aria-hidden="true"
      class={[
        'inline-grid shrink-0 place-items-center rounded-sm font-semibold leading-none text-paper select-none',
        BOT_SWATCH[props.bot.color],
        props.size === 'md' ? 'size-6 text-ui' : 'size-4 text-meta',
      ]}
    >
      {initial(props.bot.name)}
    </span>
  );
}
