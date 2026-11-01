import { For, Show, createMemo, createSignal } from 'solid-js';

import { updateSettings, useSettings } from '../settings';
import { modelKey, useModels } from './models';
import { Card } from '../ui/Card';
import { CheckMark } from '../ui/CheckMark';
import { CloseIcon, PlusIcon } from '../ui/icons';
import { NoMatches, OptionGroup, OptionList, optionClass } from '../ui/Option';
import { Popover, PopoverSearch } from '../ui/Popover';
import { matches } from '../ui/search';
import { isTouch } from '../ui/layout';

// OpenRouter alone has hundreds: past this, a provider waits for a search.
const PER_PROVIDER = 30;

/**
 * Settings → Model picker: the models the picker offers, one row each, and
 * Add models for the rest. With none chosen, the picker offers them all.
 */
export default function ModelFavorites() {
  const catalog = useModels();
  const settings = useSettings();
  const enabled = createMemo(() => settings().enabled, {
    name: 'enabledModels',
  });
  const set = (keys: string[]) => void updateSettings({ enabled: keys });
  const providerName = (id: string) =>
    catalog().providers.find((p) => p.id === id)?.name ?? id;
  // Chosen models in catalog order; one gone with its provider stays
  // listed, so it can be removed.
  const chosen = createMemo(
    () => {
      const keys = new Set(enabled());
      const found = catalog().models.filter((m) =>
        keys.has(modelKey(m.provider, m.id)),
      );
      const known = new Set(found.map((m) => modelKey(m.provider, m.id)));
      return [
        ...found.map((m) => ({
          key: modelKey(m.provider, m.id),
          name: m.name,
          provider: providerName(m.provider),
          gone: false,
        })),
        ...[...keys]
          .filter((k) => !known.has(k))
          .map((k) => ({ key: k, name: k, provider: '', gone: true })),
      ];
    },
    { name: 'chosenModels' },
  );

  return (
    <Card
      title="Model picker"
      description={
        enabled().length
          ? 'The picker offers only these.'
          : `None chosen, so the picker offers all ${catalog().models.length}.`
      }
    >
      <Show when={chosen().length}>
        <ul class="flex flex-col p-1">
          <For each={chosen()} keyed={(m) => m.key}>
            {(m) => (
              <li class="group/row flex h-9 items-center gap-2.5 rounded-lg px-2.5 transition-colors hover:bg-hover touch:h-11">
                <span class="min-w-0 flex-1 truncate">
                  <span class={m().gone ? 'text-muted' : undefined}>
                    {m().name}
                  </span>
                  <span class="ml-2 text-meta text-muted">
                    {m().gone ? 'Provider not connected' : m().provider}
                  </span>
                </span>
                <button
                  type="button"
                  class="grid size-6 place-items-center rounded-md text-muted opacity-0 transition-[opacity,background-color,color] group-hover/row:opacity-100 hover:bg-active hover:text-fg focus-visible:opacity-100 touch:size-9 touch:opacity-100"
                  aria-label={`Remove ${m().name}`}
                  onClick={() => set(enabled().filter((k) => k !== m().key))}
                >
                  <CloseIcon />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <AddModels enabled={enabled()} onChange={set} />
    </Card>
  );
}

function AddModels(props: {
  enabled: string[];
  onChange: (keys: string[]) => void;
}) {
  const id = 'add-models';
  const catalog = useModels();
  let search: HTMLInputElement | undefined;
  const [query, setQuery] = createSignal('', { name: 'addModelQuery' });
  const on = createMemo(() => new Set(props.enabled), { name: 'modelsOn' });
  const groups = createMemo(
    () => {
      const c = catalog();
      return c.providers
        .map((p) => {
          const found = c.models.filter(
            (m) =>
              m.provider === p.id && matches(query(), m.name, m.id, p.name),
          );
          return {
            id: p.id,
            name: p.name,
            models: found.slice(0, PER_PROVIDER),
            more: Math.max(0, found.length - PER_PROVIDER),
          };
        })
        .filter((g) => g.models.length);
    },
    { name: 'addModelGroups' },
  );
  const toggle = (key: string) =>
    props.onChange(
      on().has(key)
        ? props.enabled.filter((k) => k !== key)
        : [...props.enabled, key],
    );

  return (
    <>
      <button
        type="button"
        popovertarget={id}
        style={{ 'anchor-name': `--${id}` }}
        class="flex h-11 items-center gap-3 rounded-b-sheet px-3.5 text-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <PlusIcon />
        Add models
      </button>
      <Popover
        id={id}
        label="Add models"
        onToggle={(open) => {
          if (open && !isTouch()) search?.focus();
          if (!open) setQuery('');
        }}
      >
        <PopoverSearch
          ref={(el) => (search = el)}
          label="Search models"
          value={query()}
          onInput={setQuery}
        />
        <OptionList class="max-h-[60dvh] md:max-h-96">
          <Show when={!groups().length}>
            <NoMatches>No model matches.</NoMatches>
          </Show>
          <For each={groups()} keyed={(g) => g.id}>
            {(g) => (
              <>
                <OptionGroup>{g().name}</OptionGroup>
                <For each={g().models} keyed={(m) => m.id}>
                  {(m) => {
                    const key = () => modelKey(m().provider, m().id);
                    return (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on().has(key()) ? 'true' : 'false'}
                        class={['group/opt', optionClass]}
                        title={key()}
                        onClick={() => toggle(key())}
                      >
                        <CheckMark on={on().has(key())} />
                        <span class="min-w-0 flex-1 truncate">{m().name}</span>
                      </button>
                    );
                  }}
                </For>
                <Show when={g().more}>
                  <p class="px-2.5 py-1.5 text-meta text-muted">
                    {g().more} more. Search to find them.
                  </p>
                </Show>
              </>
            )}
          </For>
        </OptionList>
      </Popover>
    </>
  );
}
