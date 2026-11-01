import type { AuthInteraction, AuthType } from '@earendil-works/pi-ai';

import type { Account, Accounts, SignIn } from '@bica/shared/protocol';
import { credentials, deviceId } from './credentials';
import { addExtraAccount, models } from './registry';
import { live } from '../live';
import { refreshModels } from './models';
import {
  emailOf,
  forgetAccount,
  learn,
  nameOf,
  newAccountId,
  planOf,
  useFirst as preferAccount,
} from './account-info';
import { EXA, exaAccount, exaSignIn } from './exa';
import { GUIDES } from './known-providers';
import { accountsOf, baseOf, forgetLimits, isExtra } from './plans';
import { refreshPlanUsage } from './usage';

// Only what's saved here counts: Bica reads no keys from the environment.
async function status(id: string): Promise<Account['status']> {
  const saved = await credentials.read(id);
  if (!saved) return null;
  // A key's last characters tell which one it is, as other apps show them.
  const key = saved.type === 'api_key' ? (saved.key ?? '') : '';
  const hint = key.length > 12 ? key.slice(-4) : null;
  return { type: saved.type, hint };
}

async function accounts(): Promise<Account[]> {
  const signedIn = new Set((await credentials.list()).map((c) => c.providerId));
  // Where an account stands among the signed-in ones of its plan.
  const placeOf = (id: string) => {
    const all = accountsOf(models, baseOf(id)).filter((a) => signedIn.has(a));
    return all.length > 1 ? all.indexOf(id) : null;
  };
  const list = await Promise.all(
    models.getProviders().map(async (p): Promise<Account | undefined> => {
      const guide = GUIDES[baseOf(p.id)];
      const current = await status(p.id);
      if (current?.type === 'oauth' && !emailOf(p.id))
        void learn(p.id, false, () => void feed.refresh());
      const methods: Account['methods'] = [];
      if (p.auth.oauth)
        methods.push({
          type: 'oauth',
          label: p.auth.oauth.loginLabel ?? 'Sign in',
        });
      if (p.auth.apiKey?.login)
        methods.push({ type: 'api_key', label: 'Add key' });
      return {
        id: p.id,
        name: nameOf(p.id),
        email: emailOf(p.id),
        plan: planOf(p.id),
        place: current ? placeOf(p.id) : null,
        about: guide?.about ?? null,
        link: guide?.link ?? null,
        status: current,
        methods: isExtra(p.id)
          ? methods.filter((m) => m.type === 'oauth')
          : methods,
        // A plan signed in here can take another account of the same plan.
        addAccount:
          !isExtra(p.id) &&
          !!p.auth.oauth?.isSubscription &&
          current?.type === 'oauth',
        extra: isExtra(p.id),
        tool: false,
      };
    }),
  );
  const featured = Object.keys(GUIDES);
  // Tools go after the model providers. A plan's accounts stay together,
  // in the order they're used.
  const rank = (a: Account): number => {
    if (a.tool) return Infinity;
    const base = baseOf(a.id);
    const within = accountsOf(models, base).indexOf(a.id) / 100;
    return (
      (featured.includes(base) ? featured.indexOf(base) : featured.length) +
      within
    );
  };
  const exa = exaAccount(await status(EXA));
  return [...list.filter((a) => !!a), exa].sort((a, b) => rank(a) - rank(b));
}

type Run = {
  state: SignIn;
  abort: AbortController;
  answers: Map<string, (value: string) => void>;
};
let current: Run | undefined;

const feed = live<Accounts>(async () => ({
  accounts: await accounts(),
  signIn: current ? structuredClone(current.state) : null,
}));

export const watchAccounts = feed.watch;

async function changed() {
  await Promise.all([feed.refresh(), refreshModels(), refreshPlanUsage()]);
}

// An extra account exists while it has a sign-in; one whose sign-in never
// finished goes once it's closed.
async function dropUnsigned() {
  for (const p of models.getProviders())
    if (isExtra(p.id) && !(await credentials.read(p.id))) {
      models.deleteProvider(p.id);
      await forgetAccount(p.id);
    }
}

/** Starts the sign-in of another account of a plan. */
export async function addAccount(provider: string) {
  if (!models.getProvider(provider)?.auth.oauth?.isSubscription)
    throw new Error('Only plan sign-ins take another account');
  const id = newAccountId(provider);
  addExtraAccount(id);
  await signIn(id, 'oauth');
}

/** Makes the account the one its plan's requests try first. */
export async function useFirst(id: string) {
  if (!models.getProvider(id)) throw new Error(`Unknown account ${id}`);
  await preferAccount(id);
  await changed();
}

// Two sign-ins of one account would share its limits and look like two.
async function refuseTwin(id: string) {
  const email = emailOf(id);
  const twin = accountsOf(models, baseOf(id)).find(
    (other) => other !== id && email && emailOf(other) === email,
  );
  if (!twin) return;
  await models.logout(id);
  await forgetAccount(id);
  forgetLimits(id);
  await dropUnsigned();
  throw new Error(`${email} is already signed in.`);
}

/** Runs a provider's sign-in; its steps show on `accounts`. */
export async function signIn(id: string, type: AuthType) {
  if (id !== EXA && !models.getProvider(id))
    throw new Error(`Unknown provider ${id}`);
  current?.abort.abort();
  const run: Run = {
    state: {
      id: crypto.randomUUID(),
      account: id,
      url: null,
      instructions: null,
      device: null,
      notes: [],
      progress: null,
      prompt: null,
      error: null,
    },
    abort: new AbortController(),
    answers: new Map(),
  };
  current = run;
  const { state, abort } = run;
  const update = () => {
    if (current === run) void feed.refresh();
  };

  const interaction: AuthInteraction = {
    signal: abort.signal,
    notify(event) {
      if (event.type === 'auth_url') {
        state.url = event.url;
        state.instructions = event.instructions ?? null;
      } else if (event.type === 'device_code')
        state.device = { code: event.userCode, uri: event.verificationUri };
      else if (event.type === 'info')
        state.notes.push({
          message: event.message,
          links: [...(event.links ?? [])],
        });
      else state.progress = event.message;
      update();
    },
    prompt: (prompt) =>
      new Promise((resolve, reject) => {
        const promptId = crypto.randomUUID();
        const signal = prompt.signal
          ? AbortSignal.any([prompt.signal, abort.signal])
          : abort.signal;
        // A flow may withdraw its prompt, e.g. when the callback page wins.
        const close = () => {
          run.answers.delete(promptId);
          if (state.prompt?.id === promptId) state.prompt = null;
          update();
        };
        signal.addEventListener(
          'abort',
          () => {
            close();
            reject(new Error('Cancelled'));
          },
          { once: true },
        );
        run.answers.set(promptId, (value) => {
          close();
          resolve(value);
        });
        state.prompt = {
          id: promptId,
          type: prompt.type,
          message: prompt.message,
          placeholder:
            'placeholder' in prompt ? (prompt.placeholder ?? null) : null,
          options: prompt.type === 'select' ? [...prompt.options] : [],
        };
        update();
      }),
  };

  const device = await deviceId();
  void (async () => {
    try {
      if (id === EXA) await exaSignIn(interaction);
      else
        await models.login(id, type, interaction, {
          getDeviceId: () => device,
        });
      if (type === 'oauth') {
        state.progress = 'Checking the account…';
        update();
        await learn(id, true, () => void feed.refresh());
        await refuseTwin(id);
      }
      if (current === run) current = undefined;
      await dropUnsigned();
    } catch (error) {
      if (abort.signal.aborted) return;
      state.error = error instanceof Error ? error.message : String(error);
      state.prompt = null;
      state.progress = null;
    }
    await changed();
  })();
}

export function answer(promptId: string, value: string) {
  const resolve = current?.answers.get(promptId);
  if (!resolve) throw new Error('That question is no longer open');
  resolve(value);
}

export async function cancel() {
  current?.abort.abort();
  current = undefined;
  await dropUnsigned();
  await changed();
}

export async function signOut(id: string) {
  if (id === EXA) await credentials.delete(EXA);
  else await models.logout(id);
  await forgetAccount(id);
  forgetLimits(id);
  if (isExtra(id)) models.deleteProvider(id);
  await changed();
}
