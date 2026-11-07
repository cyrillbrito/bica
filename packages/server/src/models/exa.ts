import type { AuthInteraction } from '@earendil-works/pi-ai';

import type { Account } from '@bica/shared/protocol';
import { credentials } from './credentials';

/*
 * Exa isn't a model provider, so pi-ai doesn't know it: its key turns on the
 * agents' web search and fetch (docs/tools.md). It's listed with the
 * providers, and its key is saved with theirs, under `exa`.
 */
export const EXA = 'exa';

export function exaAccount(status: Account['status']): Account {
  return {
    id: EXA,
    name: 'Exa',
    email: null,
    plan: null,
    place: null,
    about: "The agents' web search and page fetch. The free plan is enough.",
    link: { label: 'API keys', url: 'https://dashboard.exa.ai/api-keys' },
    status,
    methods: [{ type: 'api_key', label: 'Add key' }],
    addAccount: false,
    extra: false,
    tool: true,
  };
}

/** Its sign-in is one prompt for the key. */
export async function exaSignIn(interaction: AuthInteraction) {
  const key = (
    await interaction.prompt({ type: 'secret', message: 'Exa API key' })
  ).trim();
  if (!key) throw new Error('Expected a key');
  await credentials.modify(EXA, async () => ({ type: 'api_key', key }));
}

export async function exaKey() {
  const saved = await credentials.read(EXA);
  return saved?.type === 'api_key' ? saved.key : undefined;
}
