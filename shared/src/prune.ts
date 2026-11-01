// Pruning: clears old tool output from the model context, without a model
// call (docs/context-usage.md). Shared by the server, which writes the edits,
// and the browser, which shows what they would save.
import type {
  AssistantMessage,
  Message,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from '@earendil-works/pi-ai';
import { estimateMessageTokens } from '@earendil-works/pi-ai/utils/estimate';
import type { ContextEdit, ContextView } from '@earendil-works/pi-durable';

import { entryKind } from './pi-types';

export const PRUNE_HINT =
  'Clears old tool output and images from what the model reads, so the next prompt sends less. The text of your prompts, the replies and the reasoning stay, and the transcript keeps everything.';

/**
 * The entry that carries the edits, and in `data.freed` the tokens they
 * freed; it adds nothing to the context itself. Sessions store it, so its
 * kind keeps the name from when pruning was called clean up.
 */
export const PruneEntry = entryKind<{ freed?: number }>('bica.cleanup');

// Outputs and arguments this short stay as they are: they cost little and
// often carry the point ("Edited 2 files", a path, a short command).
const KEEP_OUTPUT = 300;
const KEEP_ARG = 120;
// Tasks for other sessions stay whole: the agent rereads them to know what
// it delegated, and wrote new ones as cut off as the old ones it saw.
const KEEP_WHOLE: Record<string, string> = {
  session_start: 'prompt',
  session_send: 'message',
};
// A cleared output keeps its start and end: on replays of real sessions no
// selector kept the lines the agent needed later better than these
// (docs/context-usage.md). Below PREVIEW_FROM the note alone is enough.
const PREVIEW_FROM = 1500;
const HEAD = 160;
const TAIL = 80;
const NOTE = '[Old output cleared to save context';
// A prompt's image goes too; the note after it still names its file.
const IMAGE_NOTE = '[Image cleared to save context]';

// The newest messages stay whole: the answer and its last steps are what a
// follow-up refers to. Older steps clear even inside a long turn.
const KEEP_RECENT = 6;

/** The model context as Pi Durable's ContextView holds it. */
type Context = Pick<ContextView, 'entries' | 'contributions'>;

/** Whether a result is already a pruning note, so it isn't cleared again. */
function isCleared(message: ToolResultMessage) {
  return (
    message.content[0]?.type === 'text' &&
    message.content[0].text.startsWith(NOTE)
  );
}

/**
 * What pruning may touch: all but the newest KEEP_RECENT messages. A call
 * counts as recent when its call or its output is.
 */
function oldParts(ctx: Context) {
  const messages = ctx.contributions.flat();
  const recent = new Set<string>();
  for (const m of messages.slice(-KEEP_RECENT)) {
    if (m.role === 'toolResult') recent.add(m.toolCallId);
    if (m.role === 'assistant')
      for (const b of m.content) if (b.type === 'toolCall') recent.add(b.id);
  }
  const calls = new Set<string>();
  const older = messages.slice(0, -KEEP_RECENT);
  for (const m of older)
    if (m.role === 'toolResult' && !recent.has(m.toolCallId))
      calls.add(m.toolCallId);
  return { calls, prompts: new Set<Message>(older) };
}

/**
 * Edits that prune all but the newest messages (KEEP_RECENT): tool output
 * and images give way to a note, and long tool arguments shrink to their
 * summary and first line. The text of prompts, thinking and replies stay.
 */
export function pruneEdits(ctx: Context): ContextEdit[] {
  const old = oldParts(ctx);
  const edits: ContextEdit[] = [];
  ctx.entries.forEach((entry, i) => {
    const messages = ctx.contributions[i]!;
    const cleaned = messages.map((m) => {
      if (m.role === 'toolResult')
        return old.calls.has(m.toolCallId) ? pruneResult(m) : m;
      if (m.role === 'assistant') return pruneCalls(m, old.calls);
      if (m.role === 'user' && old.prompts.has(m)) return pruneImages(m);
      return m;
    });
    if (cleaned.some((m, j) => m !== messages[j]))
      edits.push({ target: entry.id, action: 'replace', messages: cleaned });
  });
  return edits;
}

/** The tokens `edits` take off the context, as pi-ai estimates them. */
export function prunedTokens(ctx: Context, edits: readonly ContextEdit[]) {
  const at = new Map(ctx.entries.map((e, i) => [e.id, i]));
  const size = (messages: readonly Message[] = []) =>
    messages.reduce((n, m) => n + estimateMessageTokens(m), 0);
  return edits.reduce(
    (n, e) =>
      n +
      size(ctx.contributions[at.get(e.target) ?? -1]) -
      size(e.action === 'replace' ? e.messages : []),
    0,
  );
}

function pruneResult(message: ToolResultMessage): ToolResultMessage {
  const image = message.content.some((b) => b.type === 'image');
  const text = message.content
    .flatMap((b) => (b.type === 'text' ? b.text : []))
    .join('\n')
    .trim();
  if ((text.length <= KEEP_OUTPUT && !image) || isCleared(message))
    return message;
  const { details: _details, nestedCalls: _nested, ...rest } = message;
  const note = `${NOTE}, ~${estimateMessageTokens(message)} tokens. Run the tool again if you need it.]`;
  return {
    ...rest,
    content: [
      {
        type: 'text',
        text:
          text.length < PREVIEW_FROM
            ? note
            : `${note} Its start and end:\n${whole(text.slice(0, HEAD))}\n[…]\n${whole(text.slice(-TAIL))}`,
      },
    ],
  };
}

function pruneImages(message: UserMessage): UserMessage {
  if (typeof message.content === 'string') return message;
  if (!message.content.some((b) => b.type === 'image')) return message;
  return {
    ...message,
    content: message.content.map((b) =>
      b.type === 'image' ? { type: 'text', text: IMAGE_NOTE } : b,
    ),
  };
}

// A cut can split an emoji's surrogate pair, and providers reject the half.
function whole(text: string) {
  return text.replace(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/g, '');
}

function pruneCalls(
  message: AssistantMessage,
  old: ReadonlySet<string>,
): AssistantMessage {
  let changed = false;
  const content = message.content.map((block) => {
    if (block.type !== 'toolCall' || !old.has(block.id)) return block;
    const args = slim(block.arguments, KEEP_WHOLE[block.name]);
    if (!args) return block;
    changed = true;
    return { ...block, arguments: args };
  });
  return changed ? { ...message, content } : message;
}

/** Undefined when nothing is long enough to shrink. */
function slim(args: ToolCall['arguments'], keep?: string) {
  let changed = false;
  const out: ToolCall['arguments'] = {};
  for (const [key, value] of Object.entries(args)) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (key === 'summary' || key === keep || text.length <= KEEP_ARG) {
      out[key] = value;
      continue;
    }
    changed = true;
    if (key === 'code') {
      // A codemode script: the summaries of the calls it made say enough.
      const calls = [
        ...text.matchAll(/summary\s*:\s*(["'`])((?:(?!\1)[^\n]){1,120})\1/g),
      ].map((m) => m[2]);
      out[key] = calls.length
        ? `[Script cleared. Its calls: ${calls.join('; ')}]`
        : '[Script cleared]';
    } else if (typeof value === 'string') {
      // A note, not a cut string: a cut string reads like something to copy.
      const first = whole(value.trim().split('\n')[0]!.slice(0, 80));
      out[key] =
        `[Cleared to save context, ${value.length} characters. It began: ${first}]`;
    } else out[key] = '[Cleared to save context]';
  }
  return changed ? out : undefined;
}
