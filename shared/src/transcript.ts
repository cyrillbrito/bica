import type {
  AssistantMessage,
  Message as PiMessage,
  ToolCall as PiToolCall,
  ToolResultMessage,
} from '@earendil-works/pi-ai';
import {
  calculateContextTokens,
  estimateTextTokens,
} from '@earendil-works/pi-ai/utils/estimate';
import type { EntryRecord, LiveState } from '@earendil-works/pi-durable';

import { promptOf } from './images';
import type { ProjectedView } from './projection';
import { PRUNE_ENTRY } from './prune';
import type { PromptImage, SessionStatus } from './protocol';

// `key` stays the same while a row updates, so its DOM (and open state) survives.
export type Message = { key: string } & (
  | {
      kind: 'user';
      text: string;
      images: PromptImage[];
      timestamp: number;
      // Not typed by you: a note from Bica or a message from another session.
      from?: Sender;
    }
  // The end of a reply: a fork from here continues after it. `text` is its last reply, for copying.
  | { kind: 'end'; at: number; text?: string }
  // Where a forked session's own messages start.
  | { kind: 'forked' }
  // Who is in charge of a child session changed here.
  | { kind: 'in-charge'; to: 'you' | 'parent' }
  // Everything above was swapped for this summary.
  // `before`: the last measured request size; `after`: the summary's estimate.
  // `at`: the entry, so a fork from here starts with the summary.
  | {
      kind: 'compaction';
      at: number;
      summary: string;
      auto: boolean;
      before?: number;
      after: number;
    }
  // A summary is being written; `retry` after a failed attempt.
  | { kind: 'compacting'; auto: boolean; retry?: string }
  // Old tool output was cleared from here back; `freed` is missing on older ones.
  | { kind: 'prune'; at: number; freed?: number }
  // Pruning asked for in this tab, until it lands.
  | { kind: 'pruning'; running: boolean }
  | { kind: 'text' | 'error'; text: string }
  // Questions for the user; `open` while the session waits for the answer.
  // `answer`: the prompt that came next, shown in the card instead of a row.
  | {
      kind: 'ask';
      questions: Question[];
      open: boolean;
      answer?: { text: string; timestamp: number };
    }
  // What was said in a voice call, back to back.
  | { kind: 'call'; lines: VoiceLine[] }
  | Activity
);

/** Who sent a prompt you didn't type; `session` links to the sender. */
export type Sender = { label: string; session?: string };

// The labels server/src/sessions/ (tell) and session-tools.ts
// (session_send) put in front. The model reads a plain user message, which
// is the only kind that starts a run; only the transcript tells them apart.
const NOTE = '[Note from Bica, not from the user] ';
const SENT = /^\[Message from session (\d+) "(.*?)"\] /;

/** The sender and the text without its label, for a prompt sent by Bica. */
export function senderOf(text: string): { from?: Sender; text: string } {
  if (text.startsWith(NOTE))
    return { from: { label: 'Bica' }, text: text.slice(NOTE.length) };
  const sent = SENT.exec(text);
  if (sent)
    return {
      from: { label: sent[2] || `Session ${sent[1]}`, session: sent[1] },
      text: text.slice(sent[0].length),
    };
  return { text };
}

/**
 * One thing said in a voice call (server/src/voice/voice.ts). Stored as an entry
 * without model messages, so the agent never reads it.
 */
export const VOICE_ENTRY = 'bica.voice';
export type VoiceLine = { who: 'you' | 'voice'; text: string; at: number };

// A handoff from a call carries what was said since the last one, as
// Codex's voice sends a transcript delta, so the agent reads the user's own
// words and not only the voice's version. The transcript shows those lines
// already, so the prompt row leaves them out.
const CALL_WORDS = /\n\n<voice_call>\n[\s\S]*<\/voice_call>$/;

/** A handoff with the call's lines since the last one appended. */
export function withCallWords(request: string, lines: string[]) {
  return lines.length
    ? `${request}\n\n<voice_call>\nWhat was said in the voice call since the last request. It is transcribed from speech, so it may hold misheard words, half sentences, and corrections: go by the latest, and ask when a detail is unclear.\n\n${lines.join('\n')}\n</voice_call>`
    : request;
}

export function withoutCallWords(text: string) {
  return text.replace(CALL_WORDS, '');
}

/** From the agent or a prompt: voice lines and pruning don't set the status. */
export function isTurn(entry: EntryRecord) {
  return entry.kind !== VOICE_ENTRY && entry.kind !== PRUNE_ENTRY;
}

/** One question of the `ask` tool (server/src/tools/ask.ts). */
export interface Question {
  question: string;
  header: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
}

/** Thinking and tool calls with no prose between them: one compact list. */
export interface Activity {
  kind: 'activity';
  steps: Step[];
  /** Still growing: the newest group while the agent runs. */
  active: boolean;
}

export type Step = { key: string } & (
  | { kind: 'thinking'; text: string; durationMs?: number }
  | { kind: 'tools'; calls: ToolCall[] }
);

export type ToolStatus = 'pending' | 'running' | 'done' | 'error';

export interface ToolCall {
  id: string;
  name: string;
  /** Short strings only until the row opens and loads the rest (client/src/sessions/step-detail.ts). */
  args: Record<string, unknown>;
  status: ToolStatus;
  output?: string;
  details?: unknown;
  /** Lines a write or edit added and removed. */
  stats?: { added: number; removed: number };
  /** The model is still writing its arguments. */
  streaming?: boolean;
  /** While it runs, stamped by the server (server/src/tools/tool-time.ts). */
  startedAt?: number;
  durationMs?: number;
}

// The browser holds the projected view and derives what it shows.
export function toMessages(
  view: ProjectedView,
  // A fork's last inherited entry; the divider goes after it.
  forkedAt?: number,
  { thinking = true }: { thinking?: boolean } = {},
): Message[] {
  const live = liveOf(view);
  const results = new Map<string, ToolResultMessage>();
  for (const entry of view.entries)
    for (const m of entry.model ?? [])
      if (m.role === 'toolResult') results.set(m.toolCallId, m);
  const slots = new Map(live?.tools?.map((s) => [s.callId, s]));
  const waitingOn = pendingAsk(live, lastTurn(view));

  const toolCall = (block: PiToolCall): ToolCall => {
    const result = results.get(block.id);
    const slot = slots.get(block.id);
    const details = result?.details ?? slot?.details;
    const time = (details ?? {}) as {
      startedAt?: unknown;
      durationMs?: unknown;
      stats?: ToolCall['stats'];
    };
    return {
      id: block.id,
      name: block.name,
      args: block.arguments,
      status: result
        ? result.isError
          ? 'error'
          : 'done'
        : slot?.status === 'running'
          ? 'running'
          : 'pending',
      output: result ? textOf(result.content) : undefined,
      details,
      startedAt: num(time.startedAt),
      // Durable times results; older ones carry it in their details.
      durationMs: num(result?.durationMs ?? time.durationMs),
      stats: time.stats ?? (block as { stats?: ToolCall['stats'] }).stats,
      streaming: (block as { streaming?: boolean }).streaming,
    };
  };

  type Flat = { key: string } & (Exclude<Message, Activity> | Step);
  const messages: Flat[] = [];
  const add = (message: PiMessage, key: string) => {
    if (message.role === 'user') {
      const content = message.content;
      const { text, images } =
        typeof content === 'string'
          ? { text: content, images: [] }
          : promptOf(content);
      const sender = senderOf(withoutCallWords(text));
      // Whatever you send next answers the questions, card or composer. It
      // moves past the answer's end, so the prompt row's place stays the same.
      const end = messages.at(-1);
      const ask = messages.at(-2);
      if (
        !sender.from &&
        !images.length &&
        end?.kind === 'end' &&
        ask?.kind === 'ask' &&
        !ask.answer
      ) {
        messages.splice(-2, 2, end, {
          ...ask,
          answer: { text, timestamp: message.timestamp },
        });
        return;
      }
      messages.push({
        key,
        kind: 'user',
        ...sender,
        images,
        timestamp: message.timestamp,
      });
    }
    if (message.role !== 'assistant') return;
    message.content.forEach((block, i) => {
      if (block.type === 'text' && block.text.trim())
        messages.push({ key: `${key}:${i}`, kind: 'text', text: block.text });
      // The server sends a thought's text only when its row opens.
      if (
        thinking &&
        block.type === 'thinking' &&
        (block.thinking.trim() || (block as { folded?: boolean }).folded)
      )
        messages.push({
          key: `${key}:${i}`,
          kind: 'thinking',
          text: block.thinking,
          // Stamped by the server as the block streams (server/src/models/thinking-time.ts).
          durationMs: (block as { durationMs?: number }).durationMs,
        });
      // Shown as a card of its own, not a row in the activity list.
      if (block.type === 'toolCall' && block.name === ASK)
        messages.push({
          key: block.id,
          kind: 'ask',
          questions: questionsOf(block.arguments),
          open: block.id === waitingOn,
        });
      else if (block.type === 'toolCall') {
        // Calls with nothing between them ran as one round: one group.
        const last = messages.at(-1);
        if (
          last?.kind === 'tools' &&
          message.content[i - 1]?.type === 'toolCall'
        )
          last.calls.push(toolCall(block));
        // Keyed by call id, so the group survives the partial being committed.
        else
          messages.push({
            key: block.id,
            kind: 'tools',
            calls: [toolCall(block)],
          });
      }
    });
    if (message.errorMessage)
      messages.push({
        key: `${key}:error`,
        kind: 'error',
        text: message.errorMessage,
      });
  };

  // An answer ends where the next prompt starts, or at the end when idle.
  const end = (at: number | undefined) => {
    const last = messages.at(-1);
    if (
      at === undefined ||
      !last ||
      promptAt(last) !== undefined ||
      last.kind === 'end' ||
      last.kind === 'compaction' ||
      last.kind === 'prune'
    )
      return;
    let text: string | undefined;
    for (let i = messages.length - 1; i >= 0 && !text; i--) {
      const m = messages[i]!;
      if (promptAt(m) !== undefined) break;
      if (m.kind === 'text') text = m.text;
    }
    messages.push({ key: `end:${at}`, kind: 'end', at, text });
  };
  let forked = forkedAt === undefined;
  const divider = () => {
    if (forked) return;
    forked = true;
    messages.push({ key: 'forked', kind: 'forked' });
  };
  let measured: number | undefined;
  view.entries.forEach((entry, n) => {
    if (entry.kind === 'pi.user') end(view.entries[n - 1]?.id);
    if (entry.id > forkedAt!) divider();
    if (entry.kind === VOICE_ENTRY) {
      const line = entry.data as VoiceLine;
      const last = messages.at(-1);
      if (last?.kind === 'call') last.lines.push(line);
      else messages.push({ key: `${entry.id}`, kind: 'call', lines: [line] });
      return;
    }
    // A finished answer ends before a compaction or pruning, so forking it
    // keeps the context as it was; the row's own fork takes the new one.
    const settle = () => {
      const prev = view.entries[n - 1];
      const last = prev?.model?.at(-1);
      if (last?.role === 'assistant' && last.stopReason !== 'toolUse')
        end(prev!.id);
    };
    if (entry.kind === PRUNE_ENTRY) {
      settle();
      messages.push({
        key: `${entry.id}`,
        kind: 'prune',
        at: entry.id,
        freed: (entry.data as { freed?: number } | undefined)?.freed,
      });
      return;
    }
    if (entry.kind === 'pi.compaction') {
      settle();
      const text = textOf(
        (entry.model?.[0]?.content ?? []) as { type: string }[],
      );
      // Pi wraps it in a preamble and <summary> tags for the model.
      const summary =
        /<summary>\n?([\s\S]*?)\n?<\/summary>/.exec(text)?.[1] ?? text;
      messages.push({
        key: `${entry.id}`,
        kind: 'compaction',
        at: entry.id,
        summary,
        before: measured,
        after: estimateTextTokens(text),
        auto:
          (entry.data as { reason?: string } | undefined)?.reason !== 'manual',
      });
      return;
    }
    entry.model?.forEach((m, i) => {
      if (m.role === 'assistant' && calculateContextTokens(m.usage) > 0)
        measured = calculateContextTokens(m.usage);
      add(m, `${entry.id}:${i}`);
    });
  });
  if (!live?.run) end(view.entries.at(-1)?.id);
  divider();
  const compaction = live?.compactions?.[0];
  if (compaction)
    messages.push({
      key: 'compacting',
      kind: 'compacting',
      auto: compaction.reason !== 'manual',
      retry: compaction.retry?.error,
    });
  const partial = live?.generation?.message as AssistantMessage | undefined;
  if (partial) add(partial, 'live');

  const grouped: Message[] = [];
  let groups = 0;
  for (const m of messages) {
    if (m.kind !== 'thinking' && m.kind !== 'tools') {
      grouped.push(m);
      continue;
    }
    const last = grouped.at(-1);
    if (last?.kind === 'activity') last.steps.push(m);
    else
      grouped.push({
        // Counted, not taken from a step: step keys change on commit.
        key: `activity:${groups++}`,
        kind: 'activity',
        steps: [m],
        active: false,
      });
  }
  const last = grouped.at(-1);
  if (last?.kind === 'activity' && live?.run) last.active = true;
  return grouped;
}

/** When a row was sent as a prompt: yours, a note, or an answer in a card. */
export function promptAt(m: { kind: string }): number | undefined {
  const row = m as Message;
  if (row.kind === 'user') return row.timestamp;
  if (row.kind === 'ask') return row.answer?.timestamp;
}

function num(v: unknown) {
  return typeof v === 'number' ? v : undefined;
}

// Kept in step with server/src/tools/ask.ts, which the browser can't import.
const ASK = 'ask';

/** The arguments as they stream in: any field may still be missing. */
function questionsOf(args: Record<string, unknown>): Question[] {
  const list = Array.isArray(args.questions) ? args.questions : [];
  return list.map((q: Partial<Question> | undefined) => ({
    question: typeof q?.question === 'string' ? q.question : '',
    header: typeof q?.header === 'string' ? q.header : '',
    options: (Array.isArray(q?.options) ? q.options : []).filter(
      (o) => typeof o?.label === 'string',
    ),
    multiSelect: q?.multiSelect === true,
  }));
}

/**
 * The `ask` call the session waits on: the run ended on its result and
 * nothing came after. Any prompt, an answer or not, moves on.
 */
// The server reads Pi's live doc, the browser its projection: both keep these.
type Run = Pick<LiveState, 'run' | 'generation'>;

function pendingAsk(live: Run | undefined, newest: EntryRecord | undefined) {
  if (live?.run) return undefined;
  const last = newest?.model?.at(-1);
  return last?.role === 'toolResult' && last.toolName === ASK && !last.isError
    ? last.toolCallId
    : undefined;
}

function textOf(content: readonly { type: string; text?: string }[]) {
  return content
    .flatMap((b) => (b.type === 'text' && b.text ? [b.text] : []))
    .join('\n');
}

/** Shared by the session list (server) and the open session (browser). */
export function statusOf(
  live: Run | undefined,
  newest: EntryRecord | undefined,
): SessionStatus {
  if (live?.run) return live.generation?.retry ? 'retrying' : 'running';
  if (pendingAsk(live, newest)) return 'waiting';
  const last = newest?.model?.at(-1);
  return last?.role === 'assistant' && last.stopReason === 'error'
    ? 'error'
    : 'idle';
}

export function viewStatus(view: ProjectedView) {
  return statusOf(liveOf(view), lastTurn(view));
}

// Voice lines come and go during a run; the status follows the agent.
function lastTurn(view: ProjectedView) {
  return view.entries.findLast(isTurn);
}

function liveOf(view: ProjectedView) {
  return view.docs['pi.live'];
}
