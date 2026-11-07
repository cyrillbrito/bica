import type { UsageState } from '@earendil-works/pi-durable';
import type { JSX } from '@solidjs/web';
import { For, Show, createMemo, createSignal } from 'solid-js';

import type { ContextBreakdown, Item } from '@bica/shared/context-breakdown';
import { cacheLeft, type ContextUsage } from '@bica/shared/context-usage';
import { compactHint, compactSession, isCompacting } from './context-usage';
import { formatCost, formatTokens } from '../ui/format';
import { formatDuration, tick } from '../ui/time';
import ContextField, { percent } from './ContextField';
import { Breakdown } from '../ui/Breakdown';
import Alert from '../ui/Alert';
import { Button } from '../ui/Button';
import Chevron from '../ui/Chevron';
import { Dialog, dialogBody } from '../ui/Dialog';
import Input from '../ui/Input';
import Summary from '../ui/Summary';
import { errorText } from '../ui/errors';

export interface Spend {
  model: string;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  cost: number;
}

/** Spend per model, most first, from Pi Durable's usage tracking. */
export function spendOf(usage: UsageState | undefined): Spend[] {
  return Object.entries(usage?.models ?? {})
    .map(([model, u]) => ({
      model,
      input: u.input,
      cacheRead: u.cacheRead,
      cacheWrite: u.cacheWrite,
      output: u.output,
      cost: u.cost.total,
    }))
    .sort((a, b) => b.cost - a.cost);
}

/**
 * The context details: the field of cells, the biggest items, the cache and
 * spend, and Compact with what to keep. The chip's menu opens it.
 */
export default function ContextDetails(props: {
  id: string;
  usage: ContextUsage & ContextBreakdown;
  spend: Spend[];
  ref: (dialog: HTMLDialogElement) => void;
}) {
  let dialog!: HTMLDialogElement;
  return (
    <Dialog
      ref={(el) => {
        dialog = el;
        props.ref(el);
      }}
      title="Context"
    >
      <div
        class={[dialogBody, 'flex flex-col divide-y divide-line px-4 *:py-4']}
      >
        <ContextField id={props.id} usage={props.usage} />
        <Biggest
          items={props.usage.biggest}
          onJump={(target) => {
            dialog.close();
            jump(target);
          }}
        />
        <Cache usage={props.usage} spend={props.spend} />
        <Compact id={props.id} usage={props.usage} />
      </div>
    </Dialog>
  );
}

function Heading(props: { children: JSX.Element }) {
  return <h3 class="text-meta font-medium text-muted">{props.children}</h3>;
}

function Biggest(props: {
  items: Item[];
  onJump: (target: Item['target']) => void;
}) {
  return (
    <Show when={props.items.length}>
      <section class="flex flex-col gap-1">
        <Heading>Biggest</Heading>
        <div class="-mx-1.5 flex flex-col">
          <For each={props.items} keyed={(i) => JSON.stringify(i.target)}>
            {(item) => (
              <button
                type="button"
                class="flex h-8 items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-hover touch:h-11"
                onClick={() => props.onJump(item().target)}
              >
                <span class="max-w-24 shrink-0 truncate text-muted">
                  {item().label}
                </span>
                <span class="min-w-0 flex-1 truncate font-mono text-meta">
                  {item().detail}
                </span>
                <span class="tabular-nums">{formatTokens(item().tokens)}</span>
              </button>
            )}
          </For>
        </div>
      </section>
    </Show>
  );
}

function Cache(props: {
  usage: ContextUsage & ContextBreakdown;
  spend: Spend[];
}) {
  const totals = createMemo(
    () => {
      const t = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, cost: 0 };
      for (const s of props.spend) {
        t.input += s.input;
        t.cacheRead += s.cacheRead;
        t.cacheWrite += s.cacheWrite;
        t.output += s.output;
        t.cost += s.cost;
      }
      return t;
    },
    { name: 'spendTotals' },
  );
  const sent = () => totals().input + totals().cacheRead + totals().cacheWrite;
  const [measure, setMeasure] = createSignal<'cost' | 'tokens'>('cost', {
    name: 'spendMeasure',
  });
  const left = () => cacheLeft(props.usage, tick());
  const cold = () =>
    !props.usage.running && left() !== undefined && left()! <= 0;

  return (
    <Show when={props.spend.length}>
      <section class="flex flex-col gap-2.5">
        <Heading>Cache and spend</Heading>
        <dl class="grid grid-cols-4 gap-2">
          <Stat
            label="Cache"
            value={
              props.usage.running
                ? 'In use'
                : left() === undefined
                  ? '—'
                  : left()! > 0
                    ? `Warm ${formatDuration(left()!)}`
                    : 'Cold'
            }
            tone={cold() ? 'warn' : undefined}
          />
          <Stat
            label="Hit rate"
            value={sent() ? percent(totals().cacheRead, sent()) : '—'}
          />
          <Stat label="Misses" value={String(props.usage.misses)} />
          <Stat label="Spent" value={formatCost(totals().cost)} />
        </dl>
        <Show when={cold()}>
          <p class="text-meta text-muted">
            Next turn rewrites ~{formatTokens(props.usage.used)} to the cache.
          </p>
        </Show>
        <Breakdown
          title="By model"
          items={props.spend.map((m) => ({
            id: m.model,
            label: m.model.split('/').pop()!,
            value:
              measure() === 'cost'
                ? m.cost
                : m.input + m.cacheRead + m.cacheWrite + m.output,
          }))}
          format={measure() === 'cost' ? formatCost : formatTokens}
          totalLabel={
            measure() === 'cost'
              ? 'Spent, at API prices'
              : 'Tokens sent and received'
          }
          options={[
            { id: 'cost', label: 'Cost' },
            { id: 'tokens', label: 'Tokens' },
          ]}
          option={measure()}
          onOption={(id) => setMeasure(id as 'cost' | 'tokens')}
          footer="Priced at API rates, also with a subscription. Child sessions not included."
        />
        <details class="group/row -mx-1.5">
          <Summary class="text-meta">
            <span class="flex-1">Tokens by kind</span>
            <Chevron class="group-open/row:rotate-90" />
          </Summary>
          <div class="px-1.5">
            <table class="w-full text-meta tabular-nums">
              <thead class="text-muted">
                <tr>
                  <th class="py-1 text-left font-normal">Model</th>
                  <th class="py-1 text-right font-normal">Read</th>
                  <th class="py-1 text-right font-normal">Write</th>
                  <th class="py-1 text-right font-normal">New</th>
                  <th class="py-1 text-right font-normal">Out</th>
                  <th class="py-1 text-right font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                <For each={props.spend} keyed={(s) => s.model}>
                  {(s) => (
                    <tr class="border-t border-line">
                      <td class="max-w-24 truncate py-1.5">
                        {s().model.split('/').pop()}
                      </td>
                      <td class="py-1.5 text-right">
                        {formatTokens(s().cacheRead)}
                      </td>
                      <td class="py-1.5 text-right">
                        {formatTokens(s().cacheWrite)}
                      </td>
                      <td class="py-1.5 text-right">
                        {formatTokens(s().input)}
                      </td>
                      <td class="py-1.5 text-right">
                        {formatTokens(s().output)}
                      </td>
                      <td class="py-1.5 text-right">{formatCost(s().cost)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </Show>
  );
}

function Stat(props: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div class="flex min-w-0 flex-col">
      <dt class="text-meta text-muted">{props.label}</dt>
      <dd
        class={[
          'truncate font-medium tabular-nums',
          props.tone === 'warn' && 'text-warn',
        ]}
      >
        {props.value}
      </dd>
    </div>
  );
}

function Compact(props: { id: string; usage: ContextUsage }) {
  const [error, setError] = createSignal('', { name: 'compactError' });
  let focus!: HTMLInputElement;
  return (
    <section class="flex flex-col gap-2">
      <Heading>Compact</Heading>
      <form
        class="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            await compactSession(props.id, focus.value);
            focus.value = '';
          } catch (err) {
            setError(errorText(err));
          }
        }}
      >
        <Input
          ref={(el) => (focus = el)}
          class="h-8 min-w-0 flex-1 touch:h-11"
          placeholder="What to keep (optional)"
        />
        <Button
          type="submit"
          variant="outline"
          loading={isCompacting(props.id, props.usage)}
        >
          Compact
        </Button>
      </form>
      <Show when={error()}>
        <Alert>{error()}</Alert>
      </Show>
      <p class="text-meta text-muted">
        {compactHint(props.usage)} The agent can keep working.
      </p>
    </section>
  );
}

/** Scrolls the transcript to a row and opens it. */
function jump(target: Item['target']) {
  const el =
    'call' in target
      ? document.querySelector(`[data-call="${CSS.escape(target.call)}"]`)
      : document.querySelector(`[data-key="${CSS.escape(target.key)}"]`);
  if (!(el instanceof HTMLElement)) return;
  if (el instanceof HTMLDetailsElement) el.open = true;
  el.scrollIntoView({ block: 'center' });
  el.animate(
    [
      { boxShadow: '0 0 0 2px var(--color-accent)' },
      { boxShadow: '0 0 0 2px transparent' },
    ],
    { duration: 1600, easing: 'ease-out' },
  );
}
