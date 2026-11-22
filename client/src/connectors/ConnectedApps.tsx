import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';

import type { AppChoice, ConnectedApp } from '@bica/shared/protocol';
import Alert from '../ui/Alert';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, checkKey } from '../ui/Field';
import { errorText } from '../ui/errors';
import { CloseIcon, ExternalIcon, PlusIcon } from '../ui/icons';
import { isTouch } from '../ui/layout';
import { NoMatches, OptionList, optionClass } from '../ui/Option';
import { Popover, PopoverSearch } from '../ui/Popover';
import { Spinner } from '../ui/Spinner';
import { Tag } from '../ui/Tag';
import AppLogo from './AppLogo';
import {
  connect,
  disconnect,
  searchToolkits,
  setKey,
  statusText,
  useConnectors,
} from './connectors';

// A connect just picked: its sign-in page, once the server sends it.
type Pending = AppChoice & { url?: string; activeBefore: number };

/**
 * Settings → Connected apps: the apps the agent reaches through Composio,
 * one row each, and Connect app for more. It starts with the Composio key,
 * since Composio isn't a model provider.
 */
export default function ConnectedApps() {
  const data = useConnectors();
  const [failed, setFailed] = createSignal<string | null>(null, {
    name: 'connectorError',
  });
  const [leaving, setLeaving] = createSignal<string[]>([], {
    name: 'connectorLeaving',
  });
  const [pending, setPending] = createSignal<Pending | null>(null, {
    name: 'connectorPending',
  });
  const [removing, setRemoving] = createSignal(false, {
    name: 'connectorKeyRemoving',
  });
  const removeKey = () => {
    setFailed(null);
    setRemoving(true);
    setKey(null)
      .catch((error: unknown) => setFailed(errorText(error)))
      .finally(() => setRemoving(false));
  };

  const active = (toolkit: string) =>
    data().apps.filter((a) => a.toolkit === toolkit && a.status === 'ACTIVE')
      .length;
  // Gone once the app it started shows as connected.
  const waiting = createMemo(
    () => {
      const p = pending();
      return p && active(p.slug) <= p.activeBefore ? p : null;
    },
    { name: 'connectorWaiting' },
  );
  // The row a sign-in page belongs to, when the app is listed already.
  const signInRow = createMemo(
    () => {
      const p = waiting();
      return p?.url
        ? data().apps.find(
            (a) => a.toolkit === p.slug && a.status === 'INITIATED',
          )?.id
        : undefined;
    },
    { name: 'connectorSignInRow' },
  );

  const remove = (app: ConnectedApp) => {
    setFailed(null);
    setLeaving((ids) => [...ids, app.id]);
    disconnect(app.id)
      .catch((error: unknown) => setFailed(errorText(error)))
      .finally(() => setLeaving((ids) => ids.filter((id) => id !== app.id)));
  };

  // The sign-in page opens in the click that asked for it, as in Providers:
  // the URL arrives a moment later, still inside the browser's allowance
  // for a popup. Later than that, or blocked, the link row stays.
  const choose = (choice: AppChoice) => {
    const clicked = Date.now();
    setFailed(null);
    setPending({ ...choice, activeBefore: active(choice.slug) });
    connect(choice.slug).then(
      (url) => {
        setPending((p) => (p?.slug === choice.slug ? { ...p, url } : p));
        if (Date.now() - clicked < 5000) window.open(url, '_blank', 'noopener');
      },
      (error: unknown) => {
        setPending(null);
        setFailed(errorText(error));
      },
    );
  };

  const SignInLink = (props: { url: string }) => (
    <a
      class="inline-flex items-center gap-1 text-meta text-accent-ink underline-offset-2 hover:underline"
      href={props.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open the sign-in page
      <ExternalIcon />
    </a>
  );

  const Row = (app: ConnectedApp) => {
    const status = () => statusText(app.status);
    return (
      <li class="flex items-center gap-3 px-3.5 py-3">
        <AppLogo
          tile
          name={app.name}
          logo={app.logo}
          muted={app.status !== 'ACTIVE'}
        />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="truncate font-medium" title={app.name}>
            {app.name}
          </span>
          <span class="flex min-w-0 items-center gap-2">
            <Show
              when={status().warn}
              fallback={
                <span class="truncate text-meta text-muted">
                  {status().text}
                </span>
              }
            >
              <Tag tone="warn">{status().text}</Tag>
            </Show>
            <Show when={signInRow() === app.id && waiting()?.url}>
              {(url) => <SignInLink url={url()} />}
            </Show>
          </span>
        </span>
        <span class="flex shrink-0 justify-end">
          <Button
            size="sm"
            loading={leaving().includes(app.id)}
            onClick={() => remove(app)}
          >
            Disconnect
          </Button>
        </span>
      </li>
    );
  };

  return (
    <Card
      title="Connected apps"
      description="Apps the agent can read and act in, such as Gmail, Slack, or GitHub. It asks before it creates, changes, or deletes anything."
      footer="Through Composio. Apps you connect in Composio's own apps don't show here."
    >
      <Show when={data().keyHint} fallback={<KeyForm />}>
        {(hint) => (
          <div class="flex items-center gap-3 border-b border-line px-3.5 py-3">
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="font-medium">Composio</span>
              <span class="truncate text-meta text-muted">
                Key ending in {hint()}
              </span>
            </span>
            <Button size="sm" loading={removing()} onClick={removeKey}>
              Remove key
            </Button>
          </div>
        )}
      </Show>
      <Show when={data().keyHint}>
        <Show when={data().error}>
          {(message) => (
            <div class="p-2">
              <Alert>{message()}</Alert>
            </div>
          )}
        </Show>
        <Show when={data().apps.length}>
          <ul class="flex flex-col divide-y divide-line">
            <For each={data().apps}>{Row}</For>
          </ul>
        </Show>
        <Show when={!signInRow() && waiting()}>
          {(p) => (
            <div class="flex items-center gap-3 px-3.5 py-3">
              <AppLogo tile muted name={p().name} logo={p().logo} />
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-medium">{p().name}</span>
                <Show
                  when={p().url}
                  fallback={
                    <span class="flex items-center gap-1.5 text-meta text-muted">
                      <Spinner />
                      Getting the sign-in page
                    </span>
                  }
                >
                  {(url) => <SignInLink url={url()} />}
                </Show>
              </span>
              <IconButton
                size="sm"
                title="Dismiss"
                onClick={() => setPending(null)}
              >
                <CloseIcon />
              </IconButton>
            </div>
          )}
        </Show>
        <Show when={failed()}>
          {(message) => (
            <div class="p-2">
              <Alert>{message()}</Alert>
            </div>
          )}
        </Show>
        <ConnectApp onChoose={choose} />
      </Show>
    </Card>
  );
}

/** Before anything connects: the Composio key, checked by Composio on Save. */
function KeyForm() {
  const [value, setValue] = createSignal('', { name: 'connectorKey' });
  const [tried, setTried] = createSignal(false, { name: 'connectorKeyTried' });
  const [saving, setSaving] = createSignal(false, { name: 'connectorSaving' });
  const [failed, setFailed] = createSignal<string | null>(null, {
    name: 'connectorKeyError',
  });
  const check = checkKey('composio', 'Composio');
  const save = (e: SubmitEvent) => {
    e.preventDefault();
    setTried(true);
    if (!value().trim() || check(value()).error) return;
    setFailed(null);
    setSaving(true);
    setKey(value().trim())
      .then(() => setValue(''))
      .catch((error: unknown) => setFailed(errorText(error)))
      .finally(() => setSaving(false));
  };
  return (
    <form class="flex flex-col gap-2 px-3.5 py-3" onSubmit={save}>
      <Field
        label="Composio project API key"
        type="password"
        placeholder="ak_…"
        value={value()}
        onInput={setValue}
        check={check}
        touched={tried()}
        hint={
          <a
            class="underline underline-offset-2 hover:text-fg"
            href="https://platform.composio.dev"
            target="_blank"
            rel="noreferrer"
          >
            Get one: your Composio project's Settings → API Keys. The free plan
            is enough.
          </a>
        }
      />
      <Show when={failed()}>{(message) => <Alert>{message()}</Alert>}</Show>
      <div class="flex justify-end">
        <Button
          type="submit"
          variant="soft"
          loading={saving()}
          disabled={!value().trim() && !saving()}
        >
          Save
        </Button>
      </div>
    </form>
  );
}

/** The last row: a search of Composio's catalog, one pick to connect. */
function ConnectApp(props: { onChoose: (choice: AppChoice) => void }) {
  const id = 'connect-app';
  let search: HTMLInputElement | undefined;
  const [open, setOpen] = createSignal(false, { name: 'connectOpen' });
  const [query, setQuery] = createSignal('', { name: 'connectQuery' });
  // Undefined while the first answer is on its way.
  const [found, setFound] = createSignal<AppChoice[] | undefined>(undefined, {
    name: 'connectFound',
  });
  const [failed, setFailed] = createSignal<string | null>(null, {
    name: 'connectSearchError',
  });
  const [busy, setBusy] = createSignal(false, { name: 'connectSearching' });

  // An empty search is allowed: Composio answers with popular apps.
  let asked = 0;
  createEffect(
    () => (open() ? query().trim() : null),
    (search) => {
      if (search === null) return;
      const n = ++asked;
      setBusy(true);
      const timer = setTimeout(() => {
        searchToolkits(search).then(
          (apps) => {
            if (n !== asked) return;
            setFound(apps);
            setFailed(null);
            setBusy(false);
          },
          (error: unknown) => {
            if (n !== asked) return;
            setFailed(errorText(error));
            setBusy(false);
          },
        );
      }, 200);
      return () => clearTimeout(timer);
    },
  );

  return (
    <>
      <button
        type="button"
        popovertarget={id}
        style={{ 'anchor-name': `--${id}` }}
        class="flex h-11 items-center gap-3 rounded-b-sheet px-3.5 text-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <span class="grid size-8 place-items-center" aria-hidden="true">
          <PlusIcon />
        </span>
        Connect app
      </button>
      <Popover
        id={id}
        label="Connect app"
        onToggle={(on) => {
          setOpen(on);
          if (on && !isTouch()) search?.focus();
          if (!on) setQuery('');
        }}
      >
        <PopoverSearch
          ref={(el) => (search = el)}
          label="Search apps"
          value={query()}
          onInput={setQuery}
        />
        <OptionList class="max-h-[60dvh] md:max-h-96">
          <Show when={failed()}>
            {(message) => <NoMatches>{message()}</NoMatches>}
          </Show>
          <Show when={!failed() && !busy() && found()?.length === 0}>
            <NoMatches>No app matches.</NoMatches>
          </Show>
          <For each={found() ?? []}>
            {(app) => (
              <button
                type="button"
                class={optionClass}
                onClick={() => {
                  document.getElementById(id)?.hidePopover();
                  props.onChoose(app);
                }}
              >
                <AppLogo name={app.name} logo={app.logo} />
                <span class="min-w-0 flex-1 truncate">{app.name}</span>
              </button>
            )}
          </For>
        </OptionList>
      </Popover>
    </>
  );
}
