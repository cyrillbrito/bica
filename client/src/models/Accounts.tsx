import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';

import {
  addAccount,
  answer,
  cancelSignIn,
  signIn,
  signOut,
  useAccounts,
  useFirst,
} from './models';
import type { Account, SignIn } from '@bica/shared/protocol';
import Alert from '../ui/Alert';
import { Button, buttonClass } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, checkKey } from '../ui/Field';
import { ExternalIcon, PlusIcon } from '../ui/icons';
import { Spinner } from '../ui/Spinner';
import { NoMatches, OptionGroup, OptionList, optionClass } from '../ui/Option';
import { Popover, PopoverSearch } from '../ui/Popover';
import { Tag } from '../ui/Tag';
import { providerLogo } from './provider-logos';
import { matches } from '../ui/search';
import { isTouch } from '../ui/layout';

type Method = Account['methods'][number]['type'];
type Choice = { account: Account; type: Method };

/**
 * Settings → Providers: what Bica can reach, one row each, and Add provider
 * for the rest. Only what's saved here counts, not keys in the environment.
 */
export default function Accounts() {
  const data = useAccounts();
  const [failed, setFailed] = createSignal<string | null>(null, {
    name: 'accountError',
  });
  const attempt = (action: Promise<unknown>) => {
    setFailed(null);
    action.catch((error: Error) => setFailed(error.message));
  };
  const signingIn = () => data().signIn?.account;
  // Connected ones, and the one a sign-in is running for.
  const listed = createMemo(
    () => data().accounts.filter((a) => a.status || a.id === signingIn()),
    { name: 'listedAccounts' },
  );
  const empty = () => !listed().length;

  // The sign-in page opens in the click that asked for it, so it takes one
  // click instead of two. The page arrives a moment later, still inside the
  // browser's allowance for a popup; if it's blocked, the button stays.
  let clicked = 0;
  let picked: string | undefined;
  const choose = (c: Choice) => {
    clicked = Date.now();
    // A plan already signed in takes another account.
    attempt(
      c.account.status
        ? addAccount(c.account.id)
        : signIn(c.account.id, c.type),
    );
  };
  // Plan sign-ins first ask how: a browser login calls back to localhost,
  // which only loads on the dev machine, so elsewhere take the other way
  // (a code to copy or type) without asking.
  createEffect(
    () => data().signIn?.prompt,
    (prompt) => {
      if (prompt?.type !== 'select' || Date.now() - clicked > 5000) return;
      if (prompt.id === picked) return;
      const ids = prompt.options.map((o) => o.id);
      if (!ids.includes('browser') || ids.length !== 2) return;
      picked = prompt.id;
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(
        location.hostname,
      );
      attempt(
        answer(
          prompt.id,
          local ? 'browser' : ids.find((id) => id !== 'browser')!,
        ),
      );
    },
  );
  createEffect(
    () => data().signIn?.url,
    (url) => {
      if (url && Date.now() - clicked < 5000) {
        clicked = 0;
        window.open(url, '_blank', 'noopener');
      }
    },
  );

  const Row = (a: Account) => (
    <li class="flex flex-col gap-2.5 px-3.5 py-3">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Tile id={a.id} name={a.name} on={!!a.status} />
        <span class="flex min-w-0 flex-1 flex-col">
          <span class="flex min-w-0 items-center gap-2">
            <span class="truncate font-medium">{a.name}</span>
            <Show when={a.place === 0}>
              <Tag tone="neutral" title="Requests try this account first">
                First
              </Tag>
            </Show>
          </span>
          <Status account={a} />
        </span>
        <Show when={a.status && signingIn() !== a.id}>
          {/* On a phone the actions get their own line, so the name keeps its room. */}
          <span class="flex shrink-0 justify-end max-sm:w-full max-sm:justify-start max-sm:pl-9.5">
            <Show when={(a.place ?? 0) > 0}>
              <Button size="sm" onClick={() => attempt(useFirst(a.id))}>
                Use first
              </Button>
            </Show>
            <Button size="sm" onClick={() => attempt(signOut(a.id))}>
              {a.status?.type === 'oauth' ? 'Sign out' : 'Remove'}
            </Button>
          </span>
        </Show>
      </div>
      <Show when={signingIn() === a.id}>
        <Panel
          signIn={data().signIn!}
          account={a}
          onAnswer={(id, value) => {
            clicked = Date.now();
            attempt(answer(id, value));
          }}
          onCancel={() => attempt(cancelSignIn())}
        />
      </Show>
    </li>
  );

  return (
    <Card
      title="Providers"
      description="Plans you sign in to, and API keys. A plan with more than one account uses the first until it passes 98% of a limit, then the next."
      footer={
        <>
          Kept in <code>.data/auth.json</code>.
        </>
      }
    >
      <Show
        when={!empty()}
        fallback={
          <p class="px-3.5 py-3 text-meta text-muted">
            Nothing is connected yet. Add a provider to start a session.
          </p>
        }
      >
        <ul class="flex flex-col divide-y divide-line">
          <For each={listed()}>{Row}</For>
        </ul>
      </Show>
      <Show when={failed()}>
        {(message) => (
          <div class="p-2">
            <Alert>{message()}</Alert>
          </div>
        )}
      </Show>
      <AddProvider accounts={data().accounts} onChoose={choose} />
    </Card>
  );
}

function Tile(props: { id: string; name: string; on: boolean }) {
  return (
    <span
      class={[
        'grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-well font-semibold',
        !props.on && 'text-muted',
      ]}
      aria-hidden="true"
    >
      <ProviderLogo id={props.id} fallback={props.name.slice(0, 1)} />
    </span>
  );
}

/** The provider's logo in the text color, or `fallback` where there's none. */
function ProviderLogo(props: {
  id: string;
  fallback: JSX.Element;
  class?: string;
}) {
  return (
    <Show when={providerLogo(props.id)} fallback={props.fallback}>
      {(url) => (
        <span
          class={['size-4 bg-current', props.class]}
          style={{
            'mask-image': `url(${url()})`,
            'mask-size': 'contain',
            'mask-repeat': 'no-repeat',
            'mask-position': 'center',
          }}
        />
      )}
    </Show>
  );
}

/**
 * Which account or key a row is. Every row listed is connected, so it never
 * says so; the plan goes before the email, so a long email cuts only itself.
 */
function Status(props: { account: Account }) {
  const line = () => {
    const status = props.account.status;
    if (!status) return 'Signing in…';
    if (status.type === 'api_key')
      return status.hint ? `Key ending in ${status.hint}` : 'API key';
    return (
      [props.account.plan, props.account.email].filter(Boolean).join(' · ') ||
      'Signed in'
    );
  };
  return (
    <span class="truncate text-meta text-muted" title={line()}>
      {line()}
    </span>
  );
}

/**
 * The last row of Providers: a menu of every way to connect what isn't
 * yet, one pick each, so a plan sign-in starts straight from it.
 */
function AddProvider(props: {
  accounts: Account[];
  onChoose: (choice: Choice) => void;
}) {
  const id = 'add-provider';
  let search: HTMLInputElement | undefined;
  const [query, setQuery] = createSignal('', { name: 'providerQuery' });
  const found = (...texts: string[]) => matches(query(), ...texts);
  const open = () =>
    props.accounts.filter((a) => !a.status && !a.tool && !a.extra);
  // A plan signed in already is listed again, for another account of it.
  const groups = createMemo(
    () => {
      const plans = props.accounts
        .filter((a) => (!a.status && !a.extra) || a.addAccount)
        .flatMap((a) =>
          a.methods
            .filter((m) => m.type === 'oauth' && found(a.name, a.id, 'plan'))
            .map((m) => ({
              account: a,
              type: m.type,
              title: a.name,
              note: a.status ? 'Another account' : '',
            })),
        );
      const keys = open().flatMap((a) =>
        a.methods
          .filter((m) => m.type === 'api_key' && found(a.name, a.id, 'key'))
          .map((m) => ({
            account: a,
            type: m.type,
            title: a.name,
            note: '',
          })),
      );
      const tools = props.accounts.filter(
        (a) => a.tool && !a.status && found(a.name, a.about ?? '', 'key'),
      );
      return [
        { label: 'Sign in with a plan', items: plans },
        { label: 'Add an API key', items: keys },
        {
          label: 'More',
          items: tools.map((a) => ({
            account: a,
            type: 'api_key' as const,
            title: a.name,
            note: 'For the agents',
          })),
        },
      ].filter((g) => g.items.length);
    },
    { name: 'addProviderGroups' },
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
        Add provider
      </button>
      <Popover
        id={id}
        label="Add provider"
        onToggle={(on) => {
          if (on && !isTouch()) search?.focus();
          if (!on) setQuery('');
        }}
      >
        <PopoverSearch
          ref={(el) => (search = el)}
          label="Search providers"
          value={query()}
          onInput={setQuery}
        />
        <OptionList class="max-h-[60dvh] md:max-h-96">
          <Show when={!groups().length}>
            <NoMatches>No provider matches.</NoMatches>
          </Show>
          <For each={groups()}>
            {(g) => (
              <>
                <OptionGroup>{g.label}</OptionGroup>
                <For each={g.items}>
                  {(item) => (
                    <button
                      type="button"
                      class={optionClass}
                      onClick={() => {
                        document.getElementById(id)?.hidePopover();
                        props.onChoose({
                          account: item.account,
                          type: item.type,
                        });
                      }}
                    >
                      <span
                        class="grid size-4 shrink-0 place-items-center text-meta font-semibold text-muted"
                        aria-hidden="true"
                      >
                        <ProviderLogo
                          id={item.account.id}
                          fallback={item.title.slice(0, 1)}
                        />
                      </span>
                      <span class="min-w-0 flex-1 truncate">{item.title}</span>
                      <Show when={item.note}>
                        <span class="truncate text-meta text-muted">
                          {item.note}
                        </span>
                      </Show>
                    </button>
                  )}
                </For>
              </>
            )}
          </For>
        </OptionList>
      </Popover>
    </>
  );
}

function Panel(props: {
  signIn: SignIn;
  account: Account;
  onAnswer: (prompt: string, value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = createSignal('', { name: 'signInAnswer' });
  const [tried, setTried] = createSignal(false, { name: 'signInTried' });
  const check = () =>
    props.signIn.prompt?.type === 'secret'
      ? checkKey(props.signIn.account, props.account.name)
      : undefined;

  return (
    <div class="ml-11 flex flex-col gap-3 rounded-card border border-line bg-well p-3 appear max-sm:ml-0">
      <Show when={props.account.extra}>
        <p class="text-meta">
          Sign in with the other account. If the page opens on one already here,
          switch accounts there first.
        </p>
      </Show>
      <For each={props.signIn.notes}>
        {(note) => (
          <p class="text-meta">
            {note.message}
            <For each={note.links}>
              {(link) => (
                <>
                  {' '}
                  <a
                    class="underline underline-offset-2"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label ?? link.url}
                  </a>
                </>
              )}
            </For>
          </p>
        )}
      </For>
      <Show when={props.signIn.url}>
        {(url) => (
          <div class="flex flex-col items-start gap-1.5">
            <a
              class={buttonClass({ variant: 'primary', size: 'lg' })}
              href={url()}
              target="_blank"
              rel="noreferrer"
            >
              Open the sign-in page
              <ExternalIcon />
            </a>
            <Show when={!props.signIn.prompt && props.signIn.instructions}>
              <p class="text-meta text-muted">{props.signIn.instructions}</p>
            </Show>
          </div>
        )}
      </Show>
      <Show when={props.signIn.device}>
        {(device) => (
          <p class="flex flex-col gap-1">
            <span class="text-meta text-muted">
              Enter this code at{' '}
              <a
                class="underline underline-offset-2"
                href={device().uri}
                target="_blank"
                rel="noreferrer"
              >
                {device().uri}
              </a>
            </span>
            <span class="font-mono text-display select-all">
              {device().code}
            </span>
          </p>
        )}
      </Show>
      <Show when={props.signIn.prompt}>
        {(prompt) => (
          <Show
            when={prompt().type !== 'select'}
            fallback={
              <div class="flex flex-col gap-1.5">
                <span class="text-meta text-muted">{prompt().message}</span>
                <div class="flex flex-wrap gap-1.5">
                  <For each={prompt().options}>
                    {(option) => (
                      <Button
                        variant="outline"
                        size="md"
                        title={option.description}
                        onClick={() => props.onAnswer(prompt().id, option.id)}
                      >
                        {option.label}
                      </Button>
                    )}
                  </For>
                </div>
              </div>
            }
          >
            <form
              class="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setTried(true);
                if (!value().trim() || check()?.(value()).error) return;
                props.onAnswer(prompt().id, value().trim());
                setValue('');
                setTried(false);
              }}
            >
              <Field
                label={prompt().message}
                type={prompt().type === 'secret' ? 'password' : 'text'}
                placeholder={prompt().placeholder ?? undefined}
                value={value()}
                onInput={setValue}
                check={check()}
                touched={tried()}
                autofocus
                hint={
                  prompt().type === 'secret' && props.account.link ? (
                    <a
                      class="underline underline-offset-2 hover:text-fg"
                      href={props.account.link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get one: {props.account.link.label}
                    </a>
                  ) : undefined
                }
              />
              <div class="flex justify-end">
                <Button type="submit" variant="soft" disabled={!value().trim()}>
                  {prompt().type === 'secret' ? 'Save' : 'Continue'}
                </Button>
              </div>
            </form>
          </Show>
        )}
      </Show>
      <Show when={props.signIn.progress && !props.signIn.error}>
        <p class="flex items-center gap-1.5 text-meta text-muted">
          <Spinner />
          {props.signIn.progress}
        </p>
      </Show>
      <Show when={props.signIn.error}>
        {(error) => <Alert>{error()}</Alert>}
      </Show>
      <div class="-ml-1.5">
        <Button size="sm" onClick={props.onCancel}>
          {props.signIn.error ? 'Close' : 'Cancel'}
        </Button>
      </div>
    </div>
  );
}
