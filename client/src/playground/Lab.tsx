import { Title } from '@solidjs/meta';
import type { JSX } from '@solidjs/web';
import { For, createSignal } from 'solid-js';

import TopBar from '../app/TopBar';
import { Button } from '../ui/Button';
import Empty from '../ui/Empty';
import {
  AlertIcon,
  BrewingIcon,
  DrawnCheckIcon,
  PouringIcon,
  SessionIcon,
} from '../ui/icons';

/*
 * A brainstorm, not a building block: how far Bica's coffee personality
 * could go. Everything here is throwaway, so the keyframes live in this file
 * instead of App.css.
 */
const CSS = `
.lab-wisp { animation: lab-wisp 900ms ease-out infinite; }
.lab-wisp-slow { animation: lab-wisp 2.4s ease-out infinite; }
@keyframes lab-wisp {
  from { opacity: 0; transform: translateY(2px); }
  40% { opacity: 1; }
  to { opacity: 0; transform: translateY(-2px); }
}
.lab-puff { animation: lab-puff 1s ease-out both; }
@keyframes lab-puff {
  from { opacity: 0; transform: translateY(3px); }
  35% { opacity: 1; }
  to { opacity: 0; transform: translateY(-3px); }
}
.lab-hop { transform-box: view-box; transform-origin: 12px 22px;
  animation: lab-hop 520ms var(--ease-spring) 650ms both; }
@keyframes lab-hop {
  0% { transform: none; }
  35% { transform: translateY(-2.5px); }
  65% { transform: scale(1.06, 0.92); }
  100% { transform: none; }
}
.lab-tip { transform-box: view-box; transform-origin: 4px 21px;
  animation: lab-tip 650ms var(--ease-spring) both; }
@keyframes lab-tip { from { transform: none; } to { transform: translateX(3px) rotate(-38deg) scale(0.9); } }
.lab-spill { stroke-dasharray: 1; animation: lab-spill 400ms var(--ease-out) 450ms both; }
@keyframes lab-spill { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.lab-tamp { animation: lab-tamp 1.4s var(--ease-out) infinite; }
@keyframes lab-tamp {
  0%, 15% { transform: translateY(-3px); }
  45%, 70% { transform: translateY(2px); }
  100% { transform: translateY(-3px); }
}
@media (prefers-reduced-motion: reduce) {
  [class*='lab-'] { animation: none !important; }
}
`;

// Lucide's coffee cup, without its steam.
const CUP =
  'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1';
const WISPS = ['M6 2v2', 'M10 2v2', 'M14 2v2'];

function Svg(props: {
  size?: number;
  stroke?: number;
  class?: string;
  children: JSX.Element;
}) {
  return (
    <svg
      width={props.size ?? 16}
      height={props.size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={props.stroke ?? 1.75}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={['shrink-0 overflow-visible', props.class]}
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

/** Done: the steam puffs once in the accent, then the cup gives a little hop. */
function ServedCup(props: { size?: number }) {
  return (
    <Svg size={props.size}>
      <g class="lab-hop">
        <path d={CUP} />
        <path d="M2 23.5h16" />
      </g>
      <For each={WISPS}>
        {(d, i) => (
          <path
            d={d}
            class="lab-puff text-accent"
            style={{ 'animation-delay': `${i() * 120}ms` }}
          />
        )}
      </For>
    </Svg>
  );
}

/** Idle for a long time: no steam, the cup gone grey. */
function ColdCup(props: { size?: number }) {
  return (
    <Svg size={props.size} class="opacity-45">
      <path d={CUP} />
    </Svg>
  );
}

/** Failed: the cup tips over and a puddle runs out. */
function SpilledCup(props: { size?: number }) {
  return (
    <Svg size={props.size} class="text-danger">
      <g class="lab-tip">
        <path d={CUP} />
      </g>
      <path d="M7 22.5H1" pathLength="1" class="lab-spill" />
    </Svg>
  );
}

/** Compacting context: a tamper pressing the grounds down. */
function TampingIcon(props: { size?: number }) {
  return (
    <Svg size={props.size}>
      <g class="lab-tamp">
        <path d="M12 3v5" />
        <path d="M7 8h10v2.5H7z" />
      </g>
      <path d="M4 14h16" />
      <path d="M5 14v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4" />
    </Svg>
  );
}

/** Waiting on you: the steam stops halfway and holds, like a held breath. */
function WaitingCup(props: { size?: number }) {
  return (
    <Svg size={props.size}>
      <path d={CUP} />
      <path d="M10 2v2" class="lab-wisp-slow text-accent" />
    </Svg>
  );
}

export default function Lab() {
  // Bumping it remounts the one-shot moments, so they play again.
  const [take, setTake] = createSignal(0, { name: 'labTake' });
  return (
    <>
      <Title>Lab</Title>
      <style>{CSS}</style>
      <TopBar>
        <h1 class="truncate font-semibold">Personality lab</h1>
      </TopBar>
      <div class="grid flex-1 overflow-y-auto overscroll-contain border-t border-line xl:grid-cols-2">
        <For each={['light', 'dark'] as const}>
          {(scheme) => (
            <div
              class="flex min-w-0 flex-col gap-8 bg-bg px-4 py-6 text-fg md:px-8"
              style={{ 'color-scheme': scheme }}
            >
              <div class="flex items-center justify-between gap-2">
                <h2 class="text-display font-semibold capitalize">{scheme}</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTake((n) => n + 1)}
                >
                  Replay moments
                </Button>
              </div>
              <For each={[take()]}>{() => <Body />}</For>
            </div>
          )}
        </For>
      </div>
    </>
  );
}

function Body() {
  return (
    <>
      <Section
        title="The dial"
        note="The same three moments, calm and warm. Calm is today's look. Warm gives finished and failed their own cup, and only the copy of the empty state changes, since starting a session keeps its plain icon."
      >
        <div class="flex flex-col gap-2">
          <Level name="Calm">
            <Empty icon={<SessionIcon />} title="No sessions" class="w-full">
              Start one from the composer.
            </Empty>
            <Moment icon={<DrawnCheckIcon />} label="Finished" />
            <Moment
              icon={<AlertIcon />}
              label="Failed"
              class="text-danger-ink"
            />
          </Level>
          <Level name="Warm">
            <Empty
              icon={<SessionIcon />}
              title="Nothing brewing"
              class="w-full"
            >
              Start a session from the composer.
            </Empty>
            <Moment icon={<ServedCup />} label="Finished" />
            <Moment
              icon={<SpilledCup />}
              label="Failed"
              class="text-danger-ink"
            />
          </Level>
        </div>
      </Section>

      <Section
        title="Cup family at 16px"
        note="One line drawing, Lucide's cup, in currentColor. Each state changes what the steam or the cup does, never the style. Accent only on the part that moves."
      >
        <div class="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          <Glyph icon={<BrewingIcon />} name="Working" note="today" />
          <Glyph icon={<PouringIcon />} name="Working" note="today" />
          <Glyph icon={<WaitingCup />} name="Waiting on you" />
          <Glyph icon={<ServedCup />} name="Finished" note="plays once" />
          <Glyph icon={<SpilledCup />} name="Failed" note="plays once" />
          <Glyph icon={<TampingIcon />} name="Compacting" />
          <Glyph icon={<ColdCup />} name="Idle for days" />
        </div>
      </Section>

      <Section
        title="Same family at 24px and 48px"
        note="Where a status row has room, as in a session header or a call, and blown up to check the drawing."
      >
        <div class="flex flex-wrap items-center gap-6">
          <BrewingIconLarge />
          <WaitingCup size={24} />
          <ServedCup size={24} />
          <SpilledCup size={24} />
          <TampingIcon size={24} />
          <ColdCup size={24} />
        </div>
        <div class="flex flex-wrap items-center gap-8">
          <BrewingIconLarge size={48} />
          <WaitingCup size={48} />
          <ServedCup size={48} />
          <SpilledCup size={48} />
          <TampingIcon size={48} />
          <ColdCup size={48} />
        </div>
      </Section>
    </>
  );
}

function BrewingIconLarge(props: { size?: number }) {
  return (
    <Svg size={props.size ?? 24}>
      <path d={CUP} />
      <For each={WISPS}>
        {(d, i) => (
          <path
            d={d}
            class="lab-wisp"
            style={{ 'animation-delay': `${i() * 300}ms` }}
          />
        )}
      </For>
    </Svg>
  );
}

function Section(props: {
  title: string;
  note: string;
  children: JSX.Element;
}) {
  return (
    <section class="flex flex-col gap-3">
      <div>
        <h3 class="text-meta font-medium text-muted">{props.title}</h3>
        <p class="text-meta text-muted">{props.note}</p>
      </div>
      {props.children}
    </section>
  );
}

function Level(props: { name: string; children: JSX.Element }) {
  return (
    <div class="grid min-w-0 grid-cols-[4rem_1fr_9rem_9rem] items-center gap-3 rounded-card border border-line bg-panel p-2">
      <span class="text-meta font-medium text-muted">{props.name}</span>
      {props.children}
    </div>
  );
}

function Moment(props: { icon: JSX.Element; label: string; class?: string }) {
  return (
    <div
      class={[
        'flex h-7 items-center gap-2 px-1.5 text-ui font-medium',
        props.class,
      ]}
    >
      {props.icon}
      {props.label}
    </div>
  );
}

function Glyph(props: { icon: JSX.Element; name: string; note?: string }) {
  return (
    <div class="flex h-7 min-w-0 items-center gap-2">
      <span class="flex text-fg">{props.icon}</span>
      <span class="truncate text-ui">{props.name}</span>
      {props.note && <span class="text-meta text-muted">{props.note}</span>}
    </div>
  );
}
