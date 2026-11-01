// Builds test conversations the way the server stores them, then projects
// them the way it sends them (shared/src/projection.ts), so the session page
// and its rows read test data through the same code as live data.
import type { Message, Usage } from '@earendil-works/pi-ai';
import type {
  ConversationView,
  EntryRecord,
  LiveState,
} from '@earendil-works/pi-durable';

import {
  projector,
  stepDetail,
  type ProjectedView,
} from '@bica/shared/projection';
import { PruneEntry } from '@bica/shared/prune';
import { VoiceEntry } from '@bica/shared/transcript';
import type {
  ModelCatalog,
  PromptImage,
  StepDetail,
  ThinkingLevel,
} from '@bica/shared/protocol';

type Json = Record<string, unknown>;

/** One block of an answer. */
export type Block =
  | { think: string; ms?: number }
  | { say: string }
  | {
      tool: string;
      args: Json;
      output?: string;
      ms?: number;
      error?: boolean;
      details?: Json;
      // In a live answer: the call has returned, `ms` after it started.
      done?: boolean;
    };

/** One entry, or one answer with its tool results. */
export type Turn =
  | { user: string; images?: PromptImage[] }
  | { agent: Block[]; error?: string }
  | { compacted: string; auto?: boolean }
  | { cleaned: number }
  | { voice: ['you' | 'voice', string][] };

export interface ChatOptions {
  // When the first prompt was sent.
  start: number;
  // An answer still streaming: the run is on and its tool calls run.
  live?: Block[];
  // The provider failed and the run waits to try again.
  retry?: string;
  thinking?: ThinkingLevel;
  // Prompts waiting for the run: steered into it, or sent after it.
  queue?: ['steer' | 'followUp', string][];
}

export interface Chat {
  view: ProjectedView;
  detail: (key: string) => StepDetail | null;
}

// A model the live catalog has, so the picker shows its name.
const MODEL = { provider: 'anthropic', modelId: 'claude-opus-5-5' };
const CATALOG = {
  providers: [],
  models: [
    {
      ...MODEL,
      id: MODEL.modelId,
      name: 'Claude Opus 5.5',
      levels: [],
      contextWindow: 1_000_000,
      cacheTtl: { short: 300, long: 3600 },
    },
  ],
  compaction: {
    reserveTokens: 16_384,
    backgroundTokens: 32_768,
    keepRecentTokens: 20_000,
  },
} as unknown as ModelCatalog;

// Opus list prices, dollars per million tokens.
const PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 10 };

const SYSTEM: Message = {
  role: 'system',
  content: 'You are an expert coding assistant. '.repeat(240),
  toolsAdded: ['read', 'bash', 'edit', 'write', 'codemode', 'ask'].map(
    (name) => ({
      name,
      description: `The ${name} tool. `.repeat(60),
      parameters: {},
    }),
  ),
} as unknown as Message;

export function chat(id: string, turns: Turn[], opts: ChatOptions): Chat {
  let next = 1;
  let at = opts.start;
  // Tokens in the context: the base prompt, then every message. The last
  // request cached all it read, so each answer writes only what's new.
  let context = 9_000;
  let cached = 0;
  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  const entries: EntryRecord[] = [];
  const entry = (kind: string, model?: Message[], data?: unknown) =>
    entries.push({
      id: next++,
      conversationId: id,
      kind,
      ...(model && { model }),
      ...(data !== undefined && { data }),
    } as unknown as EntryRecord);

  const usage = (output: number): Usage => {
    const fresh = context - cached;
    const u = {
      input: 2,
      output,
      cacheRead: cached,
      cacheWrite: fresh,
      totalTokens: 2 + output + context,
      cacheWrite1h: fresh,
      cost: {
        input: (2 * PRICE.input) / 1e6,
        output: (output * PRICE.output) / 1e6,
        cacheRead: (cached * PRICE.cacheRead) / 1e6,
        cacheWrite: (fresh * PRICE.cacheWrite) / 1e6,
        total: 0,
      },
    };
    u.cost.total =
      u.cost.input + u.cost.output + u.cost.cacheRead + u.cost.cacheWrite;
    for (const k of ['input', 'output', 'cacheRead', 'cacheWrite'] as const)
      total[k] += u[k];
    total.cost += u.cost.total;
    cached = context;
    context += output;
    return u as Usage;
  };

  const content = (blocks: Block[], ids: string[]) =>
    blocks.map((b, i) => {
      if ('think' in b)
        return { type: 'thinking', thinking: b.think, durationMs: b.ms };
      if ('say' in b) return { type: 'text', text: b.say };
      return { type: 'toolCall', id: ids[i], name: b.tool, arguments: b.args };
    });
  const callIds = (blocks: Block[]) =>
    blocks.map((_, i) => `toolu_${id}_${next}_${i}`);
  const chars = (blocks: Block[]) =>
    blocks.reduce(
      (n, b) =>
        n +
        ('think' in b
          ? b.think.length
          : 'say' in b
            ? b.say.length
            : JSON.stringify(b.args).length),
      0,
    );

  entry('pi.system', [SYSTEM]);
  for (const turn of turns) {
    at += 20_000;
    if ('user' in turn) {
      const text = turn.user;
      entry('pi.user', [
        {
          role: 'user',
          content: turn.images?.length
            ? [
                ...turn.images.map((img) => ({ type: 'image', ...img })),
                { type: 'text', text },
              ]
            : text,
          timestamp: at,
        } as Message,
      ]);
      context += Math.round(text.length / 4);
    } else if ('agent' in turn) {
      const ids = callIds(turn.agent);
      const thought = turn.agent.reduce(
        (n, b) => n + ('think' in b ? (b.ms ?? 0) : 0),
        0,
      );
      at += thought + 2_000;
      entry('pi.assistant', [
        {
          role: 'assistant',
          content: content(turn.agent, ids),
          api: 'anthropic-messages',
          provider: MODEL.provider,
          model: MODEL.modelId,
          usage: usage(Math.round(chars(turn.agent) / 4) + 40),
          stopReason: turn.error
            ? 'error'
            : turn.agent.some((b) => 'tool' in b)
              ? 'toolUse'
              : 'stop',
          errorMessage: turn.error,
          timestamp: at,
        } as unknown as Message,
      ]);
      turn.agent.forEach((b, i) => {
        if (!('tool' in b)) return;
        const ms = b.ms ?? 400;
        entry(
          'pi.tool-result',
          [
            {
              role: 'toolResult',
              toolCallId: ids[i]!,
              toolName: b.tool,
              content: b.output ? [{ type: 'text', text: b.output }] : [],
              details: { startedAt: at, durationMs: ms, ...b.details },
              isError: !!b.error,
              timestamp: at + ms,
            } as Message,
          ],
          { diagnostics: [] },
        );
        context += Math.round((b.output?.length ?? 0) / 4);
        at += ms;
      });
    } else if ('cleaned' in turn) {
      entry(PruneEntry.kind, undefined, { freed: turn.cleaned });
      context -= turn.cleaned;
    } else if ('compacted' in turn) {
      entry(
        'pi.compaction',
        [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `The conversation so far was summarized:\n<summary>\n${turn.compacted}\n</summary>`,
              },
            ],
            timestamp: at,
          } as Message,
        ],
        { reason: turn.auto === false ? 'manual' : 'threshold' },
      );
      context = 9_000 + Math.round(turn.compacted.length / 4);
      cached = 0;
    } else
      for (const [who, text] of turn.voice) {
        at += 4_000;
        entry(VoiceEntry.kind, undefined, { who, text, at });
      }
  }

  let live: LiveState = {};
  if (opts.live || opts.retry) {
    const blocks = opts.live ?? [];
    const ids = callIds(blocks);
    live = {
      run: { taskId: 1, inputs: [] },
      generation: {
        attempt: opts.retry ? 2 : 1,
        message: {
          role: 'assistant',
          content: content(blocks, ids),
          api: 'anthropic-messages',
          provider: MODEL.provider,
          model: MODEL.modelId,
          usage: usage(0),
          stopReason: 'stop',
          timestamp: Date.now(),
        },
        ...(opts.retry && {
          retry: { at: Date.now() + 20_000, error: opts.retry },
        }),
      },
      tools: blocks.flatMap((b, i) =>
        'tool' in b
          ? [
              {
                callId: ids[i]!,
                name: b.tool,
                status: b.done ? ('done' as const) : ('running' as const),
                output: b.output,
                details: {
                  startedAt: Date.now() - (b.ms ?? 4_000),
                  ...(b.done && { durationMs: b.ms }),
                },
              },
            ]
          : [],
      ),
    } as unknown as LiveState;
  }

  const raw = {
    conversation: { id },
    entries,
    docs: {
      'pi.agent': { model: MODEL, thinkingLevel: opts.thinking ?? 'medium' },
      'pi.live': live,
      'pi.inbox': {
        items: (opts.queue ?? []).map(([mode, content], i) => ({
          id: String(100 + i),
          mode,
          content,
        })),
      },
      'pi.usage': {
        models: {
          [`${MODEL.provider}/${MODEL.modelId}`]: {
            ...total,
            totalTokens:
              total.input + total.output + total.cacheRead + total.cacheWrite,
            cost: { total: total.cost },
          },
        },
        tools: {},
      },
    },
  } as unknown as ConversationView;
  return {
    view: projector(() => CATALOG)(raw),
    detail: (key) => stepDetail(raw, key),
  };
}
