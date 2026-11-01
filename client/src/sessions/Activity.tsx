import { dynamic } from '@solidjs/web';
import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from 'solid-js';

import { useStepDetail } from './step-detail';
import { createStopwatch, formatDuration } from '../ui/time';
import type { Activity as ActivityData, Step } from '@bica/shared/transcript';
import { StepsIcon, ThoughtIcon } from '../ui/icons';
import Chevron from '../ui/Chevron';
import { ThinkingLoader } from '../ui/ThinkingLoader';
import ToolCalls, { LABEL, ROW, RowChevron, toolIcon } from './ToolCalls';

// Finished groups this long load folded to their header.
const FOLD_AT = 4;

/**
 * Thinking and tool calls between two pieces of prose, as one tight list.
 * Past one step a header sums it up, after affectUI's Tool Call Group and
 * Thinking State: "Working" with a live timer while it runs, then "Worked
 * for 18s · 6 tools", with the newest tools' icons stacked. It folds the
 * list away; long finished groups load folded.
 */
export default function Activity(props: { activity: ActivityData }) {
  // Seen running here: it keeps its header and stays open when it ends.
  const [seen, setSeen] = createSignal(
    untrack(() => props.activity.active),
    {
      name: 'activitySeen',
    },
  );
  createEffect(
    () => props.activity.active,
    (on) => {
      if (on) setSeen(true);
    },
  );
  const steps = () => props.activity.steps;
  const grouped = () => steps().length > 1 || seen();
  const open = untrack(() => props.activity.active || steps().length < FOLD_AT);
  const list = (
    <div class="flex flex-col">
      <For each={steps()} keyed={(s) => s.key}>
        {(step, i) => (
          <StepRow
            step={step()}
            live={props.activity.active && i() === steps().length - 1}
          />
        )}
      </For>
    </div>
  );
  return (
    <div class="rounded-card border border-line bg-well p-1">
      <Show when={grouped()} fallback={list}>
        <details class="group/act expand" open={open}>
          <Header activity={props.activity} seen={seen()} />
          <div class="mt-0.5 border-t border-line pt-0.5">{list}</div>
        </details>
      </Show>
    </div>
  );
}

function Header(props: { activity: ActivityData; seen: boolean }) {
  const calls = createMemo(() =>
    props.activity.steps.flatMap((s) => (s.kind === 'tools' ? s.calls : [])),
  );
  const thoughts = () =>
    props.activity.steps.filter((s) => s.kind === 'thinking').length;
  const failed = () => calls().filter((c) => c.status === 'error').length;
  // Rounds ran their calls in parallel: a round takes its slowest call.
  const now = createStopwatch(() => props.activity.active);
  // When a live thought started, as far as this tab knows.
  const firstSeen = new Map<string, number>();
  const time = createMemo(() => {
    let ms = 0;
    let known = false;
    for (const s of props.activity.steps) {
      if (s.kind === 'thinking') {
        if (s.durationMs !== undefined) {
          ms += s.durationMs;
          known = true;
        } else if (props.activity.active) {
          if (!firstSeen.has(s.key)) firstSeen.set(s.key, Date.now());
          ms += Math.max(0, now() - firstSeen.get(s.key)!);
          known = true;
        }
        continue;
      }
      let round = 0;
      for (const c of s.calls) {
        const took =
          c.durationMs ??
          (c.status === 'running' && c.startedAt
            ? Math.max(0, now() - c.startedAt)
            : undefined);
        if (took === undefined) continue;
        round = Math.max(round, took);
        known = true;
      }
      ms += round;
    }
    return known ? ms : undefined;
  });
  const counts = () =>
    [
      calls().length &&
        `${calls().length} ${calls().length === 1 ? 'tool' : 'tools'}`,
      thoughts() &&
        `${thoughts()} ${thoughts() === 1 ? 'thought' : 'thoughts'}`,
    ]
      .filter(Boolean)
      .join(', ');
  // Settles once, when the run moves on: the label rolls over to it.
  const doneLabel = () => {
    const t = time();
    return t !== undefined && t >= 1000
      ? `Worked for ${formatDuration(t)}`
      : 'Worked';
  };
  // The newest few kinds of tool, oldest first; a new one pops in.
  const stack = createMemo(
    () => {
      const names: string[] = [];
      for (const c of calls().toReversed()) {
        if (!names.includes(c.name)) names.unshift(c.name);
        if (names.length === 3) break;
      }
      return names;
    },
    {
      name: 'toolStack',
      equals: (a, b) => a.length === b.length && a.every((n, i) => n === b[i]),
    },
  );
  return (
    <summary
      class={[ROW, 'gap-2 text-muted hover:text-fg']}
      aria-label={`${props.activity.active ? '' : `${doneLabel()}, `}${counts()}${failed() ? `, ${failed()} failed` : ''}`}
    >
      {/* While it runs, the line at the bottom of the transcript says so. */}
      <Show when={!props.activity.active} fallback={<StepsIcon />}>
        <ThinkingLoader
          label="Working"
          done
          doneLabel={doneLabel()}
          doneIcon={<StepsIcon />}
          labelClass="font-medium"
        />
      </Show>
      <span class="flex min-w-0 items-baseline gap-1.5 truncate text-meta tabular-nums">
        <span class="truncate">{counts()}</span>
        <Show when={failed()}>
          <span class="shrink-0 text-danger">· {failed()} failed</span>
        </Show>
      </span>
      <span class="ml-auto flex shrink-0 items-center pl-2" aria-hidden="true">
        <For each={stack()} keyed={(n) => n}>
          {(name) => {
            const Icon = dynamic(() => toolIcon(name()));
            return (
              <span
                class={[
                  'grid size-5 place-items-center rounded-sm border border-line bg-surface text-muted ring-2 ring-panel not-first:-ml-1 [&_svg]:size-3',
                  props.seen && 'swap-in',
                ]}
              >
                <Icon />
              </span>
            );
          }}
        </For>
      </span>
      <Chevron class="group-open/act:rotate-90" />
    </summary>
  );
}

function StepRow(props: { step: Step; live: boolean }) {
  // A timed block has ended, even if the message is still streaming.
  const thinking = (step: { durationMs?: number }) =>
    props.live && step.durationMs === undefined;
  // The server sends a thought's text only when it's opened.
  const [text, setText] = createSignal('');
  const load = useStepDetail();
  // Seen thinking: the rays settle into the bulb when it ends. A thought
  // that was already over when it loaded just shows the bulb.
  const live = () => props.step.kind === 'thinking' && thinking(props.step);
  const [seen, setSeen] = createSignal(untrack(live));
  createEffect(live, (on) => {
    if (on) setSeen(true);
  });
  const open = (key: string) =>
    void load(key).then((d) => d && 'text' in d && setText(d.text));
  return (
    <Switch>
      <Match when={props.step.kind === 'tools' ? props.step.calls : undefined}>
        {(calls) => <ToolCalls calls={calls()} />}
      </Match>
      <Match when={props.step.kind === 'thinking' ? props.step : undefined}>
        {(step) => (
          <details
            class="group/row expand"
            onToggle={(e) => e.currentTarget.open && open(step().key)}
          >
            <summary class={ROW}>
              <Show
                when={seen()}
                fallback={
                  <>
                    <ThoughtIcon />
                    <span class={LABEL}>Thought</span>
                  </>
                }
              >
                <ThinkingLoader
                  fit={false}
                  labelClass={LABEL}
                  label="Thinking"
                  done={!thinking(step())}
                  doneLabel="Thought"
                  doneIcon={<ThoughtIcon />}
                />
              </Show>
              <Show when={(step().durationMs ?? 0) >= 1000}>
                <span class="min-w-0 flex-1 truncate text-meta text-muted/70 tabular-nums">
                  for {formatDuration(step().durationMs!)}
                </span>
              </Show>
              <RowChevron />
            </summary>
            <div class="mt-1 mb-2 md:ml-7.5">
              <div class="rounded-md border border-line bg-bg px-2.5 py-2 leading-relaxed whitespace-pre-wrap text-muted md:max-h-80 md:overflow-auto md:overscroll-contain md:px-3">
                {step().text || text()}
              </div>
            </div>
          </details>
        )}
      </Match>
    </Switch>
  );
}
