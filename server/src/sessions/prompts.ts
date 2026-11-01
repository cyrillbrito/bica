import {
  AgentDoc,
  type ConversationId,
  InboxDoc,
  type InboxItem,
} from '@earendil-works/pi-durable';

import { contextUsage, pruneBlocked } from '@bica/shared/context-usage';
import { promptBlocks, promptOf } from '@bica/shared/images';
import { PruneEntry, pruneEdits, prunedTokens } from '@bica/shared/prune';
import type { ModelChoice, PromptImage } from '@bica/shared/protocol';
import { context, getHarness } from '../harness';
import { getAgent } from '../agents/registry';
import { loadMemory, projectList } from '../agents/common';
import { defaultChoice, getCatalog } from '../models/models';
import { checkChoice, models, reachable } from '../models/registry';
import { readSession } from './read';
import { saveImage } from './attachments';
import { agentIdOf, editSession, getConversation, sessionMeta } from './store';

const steerWatchers = new Map<string, Set<() => void>>();

/**
 * Calls `fn` once something steers session `id`, so a long wait in a tool
 * ends and the agent reads it. Returns the unsubscribe.
 */
export function onSteer(id: string, fn: () => void) {
  const set = steerWatchers.get(id) ?? new Set();
  steerWatchers.set(id, set.add(fn));
  return () => {
    set.delete(fn);
    if (!set.size) steerWatchers.delete(id);
  };
}

/** Every path that steers calls this, or a waiting tool hides the steer. */
function steered(id: ConversationId) {
  for (const fn of steerWatchers.get(String(id)) ?? []) fn();
}

/** Who sends a prompt: the user, Bica's own notes, or another session's id. */
export type Sender = 'user' | 'bica' | (string & {});

export async function submit(
  id: string,
  prompt: string,
  images: PromptImage[],
  requestId: string,
  from: Sender,
  whenBusy: 'followUp' | 'steer' = 'followUp',
) {
  const conversation = await getConversation(id);
  const meta = await sessionMeta(conversation.id);
  // Its one prompt waits for tonight (docs/night-runs.md); a second would run now.
  if (meta?.tonight)
    throw new Error(
      'This session is held for tonight: edit its prompt, or run it now',
    );
  // Writing to it means it isn't done with, and an archived one hears no notes.
  if (from === 'user' && meta?.archivedAt)
    await editSession(conversation.id, (m) => {
      delete m.archivedAt;
    });
  // Anything sent here starts a run, and agents took a note or another
  // session's message for the end of their questions.
  if (from !== 'user' && (await readSession(id)).status === 'waiting')
    prompt += `\n\n(This isn't the user's answer: your questions to them are still open.)`;
  await keepCopies(conversation.id);
  await keepModel(conversation.id);
  await recordSender(conversation.id, from);
  // Pi Durable returns the existing submission for a repeated requestId.
  const submission = await conversation.submit(
    { type: 'input', content: input(prompt, images), requestId, whenBusy },
    context,
  );
  if (whenBusy === 'steer') steered(conversation.id);
  return submission;
}

/** Notes who sent the newest prompt, for session_read and notes. */
export async function recordSender(id: ConversationId, from: Sender) {
  await editSession(id, (meta) => {
    meta.lastFrom = from;
  });
}

/**
 * Takes the memory index, and the project list for an agent with a
 * `projects` section such as the hub's, when the session holds
 * no copy: at its first prompt and after a compaction (store.ts). The prompt sections
 * show the copies (server/src/agents/registry.ts), since the agent
 * edits memory mid-session and every change would be sent again. Every
 * prompt path calls it, voice included.
 */
export async function keepCopies(id: ConversationId) {
  const [agent, meta] = await Promise.all([
    (await getHarness()).snapshot(AgentDoc, id, context),
    sessionMeta(id),
  ]);
  if (!agent?.cwd) return;
  // Sessions from before the prompt sections stored their instructions.
  if (agent.instructions !== undefined)
    await (
      await getConversation(String(id))
    ).configure({ instructions: null }, context);
  if (meta?.memory !== undefined && meta.projects !== undefined) return;
  const taken = {
    memory: meta?.memory ?? (await loadMemory(agent.cwd)),
    projects:
      meta?.projects ??
      (getAgent(agentIdOf(meta)).sections.projects ? await projectList() : ''),
  };
  await editSession(id, (meta) => void Object.assign(meta, taken));
}

/**
 * Moves a session off a model no sign-in reaches any more, such as one from
 * a provider signed out of, so the prompt doesn't fail on it. The same model
 * through another provider comes first, then the default; with neither, the
 * prompt is refused with what to sign in to.
 */
export async function keepModel(id: ConversationId) {
  const agent = await (await getHarness()).snapshot(AgentDoc, id, context);
  const ref = agent?.model;
  if (ref && (await reachable(ref))) return;
  const twin =
    ref && (await models.getAvailable()).find((m) => m.id === ref.modelId);
  const choice = twin
    ? {
        model: { provider: twin.provider, modelId: twin.id },
        thinkingLevel: agent?.thinkingLevel ?? 'medium',
      }
    : await defaultChoice();
  await (
    await getConversation(String(id))
  ).configure(await checkChoice(choice), context);
}

export type QueuedInput = Extract<InboxItem, { content: unknown }>;

export async function queued(conversationId: ConversationId) {
  const inbox = await (
    await getHarness()
  ).snapshot(InboxDoc, conversationId, context);
  return (inbox?.items ?? []).filter(
    (item): item is QueuedInput => item.mode !== 'write',
  );
}

/** Takes a queued prompt out of the queue; undefined if it was already sent. */
async function unqueue(id: string, submissionId: number) {
  const conversation = await getConversation(id);
  const item = (await queued(conversation.id)).find(
    (i) => Number(i.id) === submissionId,
  );
  if (!item) return undefined;
  const result = await (
    await getHarness()
  ).abortSubmission(item.id, context, conversation.id);
  return result === 'aborted' ? { conversation, item } : undefined;
}

/**
 * Takes a queued prompt back out. null: it was already sent (or is gone), so
 * there is nothing to give back.
 */
export async function withdraw(id: string, submissionId: number) {
  const taken = await unqueue(id, submissionId);
  return taken ? toPrompt(taken.item.content) : null;
}

/**
 * Turns a queued prompt into a steer: it joins the run after the current turn.
 * Pi Durable can't change a queued item, so it is withdrawn and steered anew;
 * false: it was already sent.
 */
export async function push(id: string, submissionId: number) {
  const taken = await unqueue(id, submissionId);
  if (!taken) return false;
  await taken.conversation.submit(
    { type: 'input', content: taken.item.content, whenBusy: 'steer' },
    context,
  );
  steered(taken.conversation.id);
  return true;
}

/**
 * Stops the run. Pi Durable drops queued prompts on abort; they are returned
 * so the browser can put them back in the prompt box.
 */
export async function stop(id: string) {
  const conversation = await getConversation(id);
  const items = await queued(conversation.id);
  await conversation.abort(context);
  return items.map((i) => toPrompt(i.content));
}

function toPrompt(content: QueuedInput['content']) {
  if (typeof content === 'string') return { prompt: content, images: [] };
  const { text, images } = promptOf(content);
  return { prompt: text, images };
}

/** Plain text, or text and images as content blocks, each image saved. */
export function input(prompt: string, images: PromptImage[]) {
  if (!images.length) return prompt;
  return promptBlocks(
    prompt,
    images.map((i) => ({ ...i, file: saveImage(i.mimeType, i.data) })),
  );
}

/** Switches the model or effort; the next request uses it. */
export async function configure(id: string, choice: ModelChoice) {
  await (
    await getConversation(id)
  ).configure(await checkChoice(choice), context);
}

/** Summarizes older context now; the summary lands at the next boundary. */
export async function compact(id: string, instructions?: string) {
  const conversation = await getConversation(id);
  await conversation.compact(instructions?.trim() || undefined, context);
}

/**
 * Clears old tool output from the model context (shared/src/prune.ts). The
 * transcript keeps everything; only what the model reads changes. While the
 * agent works, the edits land at its next step, like a steer. Resolves once
 * they landed, with the tokens freed.
 */
export async function pruneContext(id: string) {
  const conversation = await getConversation(id);
  const watch = await conversation.watch(context);
  const usage = contextUsage(watch.value, await getCatalog());
  void watch.stop();
  const blocked = pruneBlocked(usage);
  if (blocked) throw new Error(blocked);
  const view = await conversation.context(context);
  const edits = pruneEdits(view);
  if (!edits.length) return 0;
  const freed = Math.round(prunedTokens(view, edits));
  const submission = await conversation.submit(
    {
      type: 'write',
      entry: { kind: PruneEntry.kind, edits, data: { freed } },
    },
    context,
  );
  await submission.wait(context);
  return freed;
}
