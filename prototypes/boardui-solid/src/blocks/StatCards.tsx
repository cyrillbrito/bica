// Port of BoardUI's application/dashboard/stat-cards.tsx (MIT): the plain and
// footer variants, with Bica-flavored sample numbers.
import { For, Show } from 'solid-js';

import { cx } from '../ui/cx';
import { Chip } from '../ui/display';
import { Glyph, type IconComponent } from '../ui/icon';
import {
  RiArrowDownCircleFill,
  RiArrowUpCircleFill,
  RiCoinsFill,
  RiCpuLine,
  RiGitPullRequestLine,
  RiIndeterminateCircleFill,
  RiInformationFill,
  RiRobot2Line,
  RiTimerLine,
} from '../ui/icons';
import { Tooltip } from '../ui/Tooltip';

export type Stat = {
  icon: IconComponent;
  label: string;
  value: string;
  delta: string;
  deltaColor: 'lime' | 'rose' | 'neutral';
  tone?: keyof typeof TILE_TONES;
  caption?: string;
  hint?: string;
};

const TILE_TONES = {
  blue: 'from-blue-500 to-blue-600',
  orange: 'from-orange-400 to-orange-500',
  purple: 'from-purple-500 to-purple-600',
  pink: 'from-pink-500 to-pink-600',
};

const DELTA = {
  lime: {
    icon: RiArrowUpCircleFill,
    text: 'text-status-lime-text',
    pill: 'bg-status-lime-background',
  },
  rose: {
    icon: RiArrowDownCircleFill,
    text: 'text-status-rose-text',
    pill: 'bg-status-rose-background',
  },
  neutral: {
    icon: RiIndeterminateCircleFill,
    text: 'text-text-secondary',
    pill: 'bg-background-secondary-default',
  },
};

export const PLAIN_STATS: Stat[] = [
  {
    icon: RiRobot2Line,
    label: 'Sessions today',
    value: '38',
    delta: '+12%',
    deltaColor: 'lime',
  },
  {
    icon: RiCpuLine,
    label: 'Tokens used',
    value: '4.2M',
    delta: '-3.1%',
    deltaColor: 'rose',
  },
  {
    icon: RiGitPullRequestLine,
    label: 'Pull requests',
    value: '7',
    delta: '0.00%',
    deltaColor: 'neutral',
  },
  {
    icon: RiTimerLine,
    label: 'Agent hours',
    value: '11.6',
    delta: '+28%',
    deltaColor: 'lime',
  },
];

export const FOOTER_STATS: Stat[] = [
  {
    icon: RiCoinsFill,
    label: 'Spend this month',
    value: '$184.20',
    delta: '16%',
    deltaColor: 'rose',
    tone: 'blue',
    hint: 'API spend across every provider this month. Up reads in red here.',
  },
  {
    icon: RiRobot2Line,
    label: 'Sessions',
    value: '1,204',
    delta: '20%',
    deltaColor: 'lime',
    tone: 'orange',
    hint: 'Agent sessions started this month, chats included.',
  },
  {
    icon: RiGitPullRequestLine,
    label: 'Merged PRs',
    value: '86',
    delta: '8.1%',
    deltaColor: 'lime',
    tone: 'purple',
  },
  {
    icon: RiTimerLine,
    label: 'Median run',
    value: '4m 12s',
    delta: '2.4%',
    deltaColor: 'neutral',
    tone: 'pink',
  },
];

function PlainStatCard(props: { stat: Stat }) {
  return (
    <section class="flex h-[132px] min-w-0 flex-col items-start justify-between rounded-2xl bg-background-secondary-default p-4">
      <span class="flex items-center rounded-md bg-stat-card-icon-background p-1.5">
        <props.stat.icon class="size-5 shrink-0 text-foreground-icon-primary" />
      </span>
      <div class="flex w-full flex-col gap-0.5">
        <p class="w-full text-body-medium text-text-secondary">
          {props.stat.label}
        </p>
        <div class="flex w-full flex-wrap items-center gap-2">
          <p class="text-title-1-medium whitespace-nowrap text-text-primary">
            {props.stat.value}
          </p>
          <Chip variant="bold" color={props.stat.deltaColor}>
            {props.stat.delta}
          </Chip>
        </div>
      </div>
    </section>
  );
}

function FooterStatCard(props: { stat: Stat }) {
  const d = () => DELTA[props.stat.deltaColor];
  return (
    <section class="flex min-w-0 flex-col rounded-2xl bg-background-secondary-default p-2">
      <div class="flex w-full items-start justify-between gap-2.5 p-2">
        <span
          class={cx(
            'flex size-10 shrink-0 items-center justify-center rounded-2lg bg-linear-to-b',
            TILE_TONES[props.stat.tone ?? 'blue'],
          )}
        >
          <props.stat.icon class="size-5 shrink-0 text-white" />
        </span>
        <Show when={props.stat.hint}>
          <Tooltip size="md" content={props.stat.hint}>
            <button
              type="button"
              aria-label={`About ${props.stat.label}`}
              class="flex shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary outline-none transition-colors duration-150 ease hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <RiInformationFill class="size-5" />
            </button>
          </Tooltip>
        </Show>
      </div>
      <div class="flex flex-col gap-0.5 px-2 pt-2.5 pb-3.5">
        <p class="truncate text-body-medium text-text-secondary">
          {props.stat.label}
        </p>
        <p class="text-display-4-medium whitespace-nowrap text-text-primary tabular-nums">
          {props.stat.value}
        </p>
      </div>
      <div class="mt-auto flex w-full items-center justify-between gap-2 rounded-2lg bg-background-inner-default py-1.5 pe-1.5 ps-2.5 shadow-card">
        <p class="truncate text-body-regular text-text-secondary">
          {props.stat.caption ?? 'From last month'}
        </p>
        <span
          class={cx(
            'flex shrink-0 items-center gap-1 rounded-full py-0.5 pe-2 ps-1',
            d().pill,
          )}
        >
          <Glyph of={d().icon} class={cx('size-4 shrink-0', d().text)} />
          <span
            class={cx(
              'text-body-medium whitespace-nowrap tabular-nums',
              d().text,
            )}
          >
            {props.stat.delta}
          </span>
        </span>
      </div>
    </section>
  );
}

export function StatCards(props: {
  variant?: 'plain' | 'footer';
  stats?: Stat[];
  class?: string;
}) {
  const footer = () => props.variant === 'footer';
  const items = () => props.stats ?? (footer() ? FOOTER_STATS : PLAIN_STATS);
  return (
    <div
      class={cx(
        'grid w-full gap-4',
        footer()
          ? 'grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4'
          : 'grid-cols-2 xl:grid-cols-4',
        props.class,
      )}
    >
      <For each={items()}>
        {(stat) => (
          <Show when={footer()} fallback={<PlainStatCard stat={stat} />}>
            <FooterStatCard stat={stat} />
          </Show>
        )}
      </For>
    </div>
  );
}
