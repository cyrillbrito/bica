import { mkdir } from 'node:fs/promises';
import { AgentDoc } from '@earendil-works/pi-durable';

import { context, getHarness } from '../harness';
import { agentChoice } from '../agents/choice';
import { getAgent, selection } from '../agents/registry';
import { settings } from '../settings';
import { SessionDoc } from '../sessions/session-doc';
import {
  editSession,
  getConversation,
  listSessions,
  sessions,
} from '../sessions/store';

// The hub (docs/hub.md): one session of the Hub agent, in the folder from
// Settings → Hub, on the model picked there.

/** The hub's folder from Settings, or null before one is picked. */
async function hubFolder() {
  return settings().hubFolder;
}

/** The model from Settings when it is reachable, else the agent's own. */
async function hubChoice() {
  return agentChoice(getAgent('hub'), settings().hubModel);
}

/** The newest open hub session outside any project. */
async function findHub() {
  return (await listSessions()).find(
    (s) => s.agent === 'hub' && !s.archivedAt && !s.projectId,
  );
}

/** The hub's id, started in the hub folder first if there is none. */
export async function openHub() {
  const open = await findHub();
  if (open) {
    // Extensions are stored by name when the hub starts, so one added to
    // the Hub agent since then reaches it here.
    const conversation = await getConversation(open.id);
    const want = selection(getAgent('hub')) ?? [];
    const stored = (
      await (await getHarness()).snapshot(AgentDoc, conversation.id, context)
    )?.extensions;
    const has = new Set(Array.isArray(stored) ? stored : []);
    if (want.some((e) => !has.has(e.name)))
      await conversation.configure({ extensions: want }, context);
    return open.id;
  }
  const folder = await hubFolder();
  if (!folder) throw new Error('Pick a folder for the hub in Settings first');
  await mkdir(folder, { recursive: true });
  const choice = await hubChoice();
  const conversation = await (
    await getHarness()
  ).createConversation(
    {
      ownership: { kind: 'ownerless' },
      agent: {
        ...choice,
        cwd: folder,
        extensions: selection(getAgent('hub')),
      },
      init: async (tx, id) => {
        const doc = await tx.doc(SessionDoc, id);
        doc.title = 'Hub';
        doc.createdAt = Date.now();
        doc.seenEntry = 0;
        doc.profile = 'hub';
      },
    },
    context,
  );
  await sessions.refresh();
  return String(conversation.id);
}

/** After the hub settings change: the hub moves to its folder and model. */
export async function updateHub() {
  const hub = await findHub();
  if (!hub) return;
  const conversation = await getConversation(hub.id);
  const folder = await hubFolder();
  const moved = !!folder && folder !== hub.cwd;
  if (moved) await mkdir(folder, { recursive: true });
  await conversation.configure(
    { ...(await hubChoice()), ...(moved && { cwd: folder }) },
    context,
  );
  // A new folder holds other memory files.
  if (moved)
    await editSession(conversation.id, (meta) => {
      delete meta.memory;
      delete meta.projects;
    });
}
