import { For, Show, createMemo, createSignal } from 'solid-js';

import { useSettings } from '../settings';
import { modelKey, pickable, shortName, useModels } from './models';
import type {
  ModelCatalog,
  ModelChoice,
  ThinkingLevel,
} from '@bica/shared/protocol';
import { buttonClass } from '../ui/Button';
import Chevron from '../ui/Chevron';
import { CheckIcon, ThoughtIcon } from '../ui/icons';
import { NoMatches, OptionGroup, OptionList, optionClass } from '../ui/Option';
import { Popover, PopoverSearch } from '../ui/Popover';
import { Segmented, segmentClass } from '../ui/Segmented';
import { Switch } from '../ui/Switch';
import { matches } from '../ui/search';
import { formatTokens } from '../ui/format';

type Model = ModelCatalog['models'][number];

function dollars(n: number) {
  return `$${n >= 10 ? Math.round(n) : n.toFixed(2).replace(/\.?0+$/, '')}`;
}

// "400k context · $1.25 / $10 per 1M": input, then output, price.
function facts(m: Model) {
  const price = !m.cost.input
    ? null
    : m.cost.output
      ? `${dollars(m.cost.input)} / ${dollars(m.cost.output)} per 1M`
      : `${dollars(m.cost.input)} per 1M`;
  return [`${formatTokens(m.contextWindow)} context`, price]
    .filter(Boolean)
    .join(' · ');
}

const EFFORT: Record<ThinkingLevel, [short: string, long: string]> = {
  off: ['Off', 'No thinking'],
  minimal: ['Min', 'Minimal'],
  low: ['Low', 'Low'],
  medium: ['Med', 'Medium'],
  high: ['High', 'High'],
  xhigh: ['XHigh', 'Extra high'],
  max: ['Max', 'Max'],
};

let nextId = 0;

/** `want` when the model has it, else its nearest level. */
function levelFor(m: Model, want: ThinkingLevel): ThinkingLevel {
  if (!m.levels.length || m.levels.includes(want)) return want;
  const order = Object.keys(EFFORT) as ThinkingLevel[];
  const at = order.indexOf(want);
  return [...m.levels].sort(
    (a, b) => Math.abs(order.indexOf(a) - at) - Math.abs(order.indexOf(b) - at),
  )[0]!;
}

/**
 * One chip for model and effort; opens a popover above it (a bottom sheet on
 * phones). Hidden while `value` is undefined (no model set yet), unless
 * `empty` gives the chip a label for that state. `effort={false}` picks a
 * model only.
 */
export default function ModelPicker(props: {
  value: ModelChoice | undefined;
  onChange: (choice: ModelChoice) => void;
  empty?: string;
  effort?: boolean;
  // Name the provider on the chip: the same model can come through several.
  provider?: boolean;
}) {
  const id = `model-picker-${++nextId}`;
  let popover: HTMLDivElement | undefined;
  const catalog = useModels();
  const settings = useSettings();
  const options = createMemo<Model[]>(
    () => pickable(catalog().models, settings().enabled, props.value),
    {
      name: 'modelOptions',
    },
  );
  const [query, setQuery] = createSignal('', { name: 'modelQuery' });
  const groups = createMemo(
    () => {
      const byProvider = new Map<string, Model[]>();
      for (const m of options().filter((m) => matches(query(), m.name, m.id))) {
        byProvider.set(m.provider, [...(byProvider.get(m.provider) ?? []), m]);
      }
      return [...byProvider].map(([id, models]) => ({
        id,
        name: catalog().providers.find((p) => p.id === id)?.name ?? id,
        models,
      }));
    },
    { name: 'modelGroups' },
  );
  const current = createMemo(
    () => {
      const v = props.value;
      return v
        ? options().find(
            (m) => m.provider === v.model.provider && m.id === v.model.modelId,
          )
        : undefined;
    },
    { name: 'currentModel' },
  );
  const thinks = () => props.effort !== false && !!current()?.levels.length;
  const [pointed, setPointed] = createSignal<string | null>(null, {
    name: 'modelPointed',
  });
  // The footer speaks for the model you point at, else the picked one.
  const shown = () =>
    options().find((m) => modelKey(m.provider, m.id) === pointed()) ??
    current();
  const effortOn = () => thinks() && !!current();
  // Models that can stop thinking get a switch; effort unfolds under it.
  const canSwitch = () =>
    !!current()?.levels.includes('off') && current()!.levels.length > 1;
  const thinking = () => props.value?.thinkingLevel !== 'off';
  const efforts = () => current()?.levels.filter((l) => l !== 'off') ?? [];
  // The effort to come back to when thinking is switched on again.
  let lastEffort: ThinkingLevel = 'medium';

  return (
    <Show when={(props.value || props.empty) && options().length}>
      <button
        type="button"
        popovertarget={id}
        // Shrinks, so a long model name truncates instead of pushing the
        // composer's send button out of view.
        class={[buttonClass({ size: 'md' }), 'min-w-0 shrink!']}
        style={{ 'anchor-name': `--${id}` }}
        title={
          props.value &&
          `${current()?.name ?? props.value.model.modelId} · ${modelKey(props.value.model.provider, props.value.model.modelId)}${
            thinks() ? ` · ${EFFORT[props.value.thinkingLevel][1]}` : ''
          }`
        }
      >
        <Show when={props.provider && props.value}>
          <span class="shrink-0 text-muted">
            {catalog().providers.find(
              (p) => p.id === props.value!.model.provider,
            )?.name ?? props.value!.model.provider}
          </span>
        </Show>
        <span class={['truncate', !props.value && 'text-muted']}>
          {props.value
            ? current()
              ? shortName(current()!, options())
              : props.value.model.modelId
            : props.empty}
        </span>
        <Show when={thinks()}>
          <span class="shrink-0 text-muted/70 @max-sm/composer:hidden">
            {EFFORT[props.value!.thinkingLevel][0]}
          </span>
        </Show>
        <Chevron class="-rotate-90 text-muted/70" />
      </button>
      <Popover
        ref={(el) => (popover = el)}
        id={id}
        label="Model and effort"
        place="top-start"
        onToggle={(open) => !open && setPointed(null)}
        tray={
          <Show when={shown()}>
            {(m) => (
              <div
                class="truncate px-3 pt-1.5 pb-0.5 text-meta text-muted tabular-nums"
                aria-hidden="true"
              >
                {facts(m())}
              </div>
            )}
          </Show>
        }
      >
        <Show when={options().length > 12}>
          <PopoverSearch
            label="Search models"
            value={query()}
            onInput={setQuery}
          />
        </Show>
        <OptionList class="max-h-[50dvh] md:max-h-80">
          <Show when={!groups().length}>
            <NoMatches>No model matches.</NoMatches>
          </Show>
          <For each={groups()} keyed={(g) => g.id}>
            {(g) => (
              <>
                {/* Labels only help when there is more than one provider. */}
                <Show when={groups().length > 1}>
                  <OptionGroup>{g().name}</OptionGroup>
                </Show>
                <For each={g().models} keyed={(m) => m.id}>
                  {(m) => {
                    const on = () => !!props.value && current() === m();
                    const key = () => modelKey(m().provider, m().id);
                    return (
                      <button
                        type="button"
                        class={optionClass}
                        title={key()}
                        aria-pressed={on() ? 'true' : 'false'}
                        onPointerEnter={() => setPointed(key())}
                        onFocus={() => setPointed(key())}
                        onClick={() => {
                          popover?.hidePopover();
                          if (on()) return;
                          props.onChange({
                            model: {
                              provider: m().provider,
                              modelId: m().id,
                            },
                            thinkingLevel: levelFor(
                              m(),
                              props.value?.thinkingLevel ?? 'medium',
                            ),
                          });
                        }}
                      >
                        <span class="truncate">{m().name}</span>
                        <Show when={on()}>
                          <span class="swap-in shrink-0 text-muted">
                            <CheckIcon />
                          </span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </>
            )}
          </For>
        </OptionList>
        <Show when={effortOn()}>
          <div class="border-t border-line p-1">
            <Show when={canSwitch()}>
              <label class="flex h-8 items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-hover touch:h-11">
                <span
                  class={[
                    'grid w-5 place-items-center transition-colors',
                    thinking() ? 'text-fg' : 'text-muted',
                  ]}
                >
                  <ThoughtIcon />
                </span>
                <span class="flex-1" title="How hard the model thinks">
                  Thinking
                </span>
                <Switch
                  checked={thinking()}
                  label="Thinking"
                  onChange={(next) =>
                    props.onChange({
                      model: props.value!.model,
                      thinkingLevel: next
                        ? levelFor(current()!, lastEffort)
                        : 'off',
                    })
                  }
                />
              </label>
            </Show>
            <div
              class="fold"
              data-open={thinking() || !canSwitch() || undefined}
              inert={canSwitch() && !thinking()}
            >
              <div>
                <div
                  class={[
                    'flex items-center gap-2 py-1 pr-1',
                    canSwitch() ? 'pl-9.5' : 'pl-2',
                  ]}
                >
                  <span class="flex-1 text-meta text-muted">Effort</span>
                  <Segmented>
                    <For each={efforts()}>
                      {(level) => (
                        <button
                          type="button"
                          class={segmentClass}
                          title={EFFORT[level][1]}
                          data-on={
                            props.value!.thinkingLevel === level || undefined
                          }
                          onClick={() => {
                            lastEffort = level;
                            props.onChange({
                              model: props.value!.model,
                              thinkingLevel: level,
                            });
                          }}
                        >
                          {EFFORT[level][0]}
                        </button>
                      )}
                    </For>
                  </Segmented>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </Popover>
    </Show>
  );
}
