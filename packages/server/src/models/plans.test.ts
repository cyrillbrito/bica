import { expect, test } from 'bun:test';
import { type AssistantMessage, createModels } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxProvider,
} from '@earendil-works/pi-ai/providers/faux';

import { extraAccount, routeAccounts, setPreferred } from './plans';

function failure(errorMessage: string) {
  return fauxAssistantMessage('', { stopReason: 'error', errorMessage });
}

/**
 * A plan with two accounts, `<id>` and `<id>:2`, tried in `order`. Each
 * answers with its reply; `null` is an account whose sign-in is gone. Each
 * case gets its own plan, since an account that failed is skipped a while.
 */
async function ask(
  id: string,
  replies: Record<'first' | 'second', AssistantMessage | Error | null>,
  order: 'base first' | 'extra first',
) {
  const faux = fauxProvider({ provider: id, tokensPerSecond: 0 });
  const models = createModels();
  models.setProvider(faux.provider);
  models.setProvider({
    ...extraAccount(faux.provider, '2'),
    auth: {
      apiKey: {
        name: 'Faux',
        resolve: async () => {
          const reply = replies[order === 'base first' ? 'second' : 'first'];
          if (reply instanceof Error) throw reply;
          return reply ? { auth: { apiKey: 'extra' } } : undefined;
        },
      },
    },
  });
  setPreferred(order === 'base first' ? [] : [`${id}:2`]);
  routeAccounts(models);
  faux.setResponses(
    Array(2).fill((_: unknown, options?: { apiKey?: string }) => {
      const extra = options?.apiKey === 'extra';
      const first = (order === 'extra first') === extra;
      return replies[first ? 'first' : 'second'];
    }),
  );
  const reply = await models.completeSimple(faux.getModel(), {
    messages: [{ role: 'user', content: 'hi', timestamp: Date.now() }],
  });
  return {
    provider: reply.provider,
    text: reply.content.flatMap((b) =>
      b.type === 'text' && b.text ? b.text : [],
    ),
    error: reply.errorMessage ?? null,
  };
}

test('a request the first account cannot take goes out on the next one', async () => {
  const answered = (provider: string) => ({
    provider,
    text: ['from the second'],
    error: null,
  });
  const second = fauxAssistantMessage('from the second');
  expect(
    await ask(
      'full',
      { first: failure('429 rate_limit_error: usage limit reached'), second },
      'base first',
    ),
  ).toEqual(answered('full'));
  expect(await ask('gone', { first: null, second }, 'extra first')).toEqual(
    answered('gone'),
  );
  expect(
    await ask(
      'expired',
      { first: new Error('OAuth refresh failed: invalid_grant'), second },
      'extra first',
    ),
  ).toEqual(answered('expired'));
});

test('an expired sign-in tells the user how to recover without a stack trace', async () => {
  const faux = fauxProvider({ provider: 'expired-single', tokensPerSecond: 0 });
  const models = createModels();
  models.setProvider({ ...faux.provider, name: 'Test plan' });
  routeAccounts(models);
  for (const detail of [
    'invalid_grant: Refresh token expired',
    'invalid_grant: Refresh token revoked',
    '503 Service unavailable',
  ]) {
    const raw = `OAuth refresh failed for expired-single: ${detail}; stack=Error at refresh`;
    faux.setResponses([failure(raw)]);
    const stream = models.streamSimple(faux.getModel(), {
      messages: [{ role: 'user', content: 'hi', timestamp: Date.now() }],
    });
    const errors: string[] = [];
    for await (const event of stream)
      if (event.type === 'error') errors.push(event.error.errorMessage ?? '');
    const expected = detail.startsWith('invalid_grant')
      ? 'Test plan sign-in expired or was revoked. Sign in again in Settings → Providers, then resend your prompt.'
      : raw;
    expect(errors).toEqual([expected]);
    expect((await stream.result()).errorMessage).toBe(expected);
  }
});

test('an error the account is not to blame for stays on it', async () => {
  expect(
    await ask(
      'busy',
      {
        first: failure('529 overloaded_error'),
        second: fauxAssistantMessage('from the second'),
      },
      'base first',
    ),
  ).toEqual({ provider: 'busy', text: [], error: '529 overloaded_error' });
});
