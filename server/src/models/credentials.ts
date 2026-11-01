import type { Credential, CredentialStore } from '@earendil-works/pi-ai';

import { jsonFile, textFile } from '../storage';

// Sign-ins and keys added in Settings (docs/models.md), one per provider id,
// in pi's auth.json shape.
const file = jsonFile<Record<string, Credential | undefined>>('auth.json', {
  initial: () => ({}),
  secret: true,
});

export const credentials: CredentialStore = {
  read: async (id) => file.read()[id],
  list: async () =>
    Object.entries(file.read()).flatMap(([providerId, c]) =>
      c ? [{ providerId, type: c.type }] : [],
    ),
  modify: async (id, fn) =>
    (
      await file.update(async (all) => {
        const next = await fn(all[id]);
        if (next) all[id] = next;
      })
    )[id],
  delete: async (id) => {
    await file.update((all) => void delete all[id]);
  },
};

// Sign in with ChatGPT names this installation with a stable UUID.
const device = textFile('device-id');

export async function deviceId() {
  const saved = device.read();
  if (saved) return saved;
  const id = crypto.randomUUID();
  await device.write(id);
  return id;
}
