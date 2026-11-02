// Runs and tools as `run_end`, `tool_use`, and `$ai_generation`
// (docs/telemetry.md), counted from what the harness commits: its entries say
// every model response and tool result, the ones Pi Durable writes itself
// (invalid arguments, unknown tools, interrupted calls) too, and `pi.live`
// says when a run starts and ends. Arguments are hashed here only to spot
// repeated calls; they and every text stay in the process.
import type {
  AssistantMessage,
  ToolResultMessage,
  Usage,
} from '@earendil-works/pi-ai';
import {
  getAllBuiltinModels,
  getBuiltinProviders,
} from '@earendil-works/pi-ai/providers/all';
import {
  AgentDoc,
  AssistantEntry,
  CompactionEntry,
  type CommitChange,
  type ConversationId,
  type EntryRecord,
  type LiveState,
  ToolResultEntry,
} from '@earendil-works/pi-durable';

import type { ThinkingLevel } from '@bica/shared/protocol';
import { context, getHarness, registry } from '../harness';
import { baseOf } from '../models/plans';
import { agentIdOf, sessionMeta } from '../sessions/store';
import type { RunOutcome } from './events';
import { hashId, offForGood, telemetryOn, track } from './telemetry';

// The tool that ends a run waiting for the user's answer (tools/ask.ts).
const ASK = 'ask';

interface Tally {
  calls: number;
  nested: number;
  errors: number;
  streak: number;
  maxStreak: number;
  maxRepeat: number;
}

interface ToolTally extends Tally {
  totalMs: number;
  maxMs: number;
}

interface Run {
  // The run's first input: Pi Durable's run identity (`pi.live` run.inputs[0]).
  key: string;
  startedAt: number;
  resumed: boolean;
  turns: number;
  compactions: number;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
  };
  model?: { provider: string; id: string; thinkingLevel?: string };
  // The model's tool calls by id: their tool, and their arguments' hash.
  calls: Map<string, { name: string; repeat: number | bigint }>;
  repeats: Map<number | bigint, number>;
  all: Tally;
  tools: Map<string, ToolTally>;
  // What ended the run so far: the newest response or tool result.
  last?: { stopReason: string } | { tool: string; isError: boolean };
}

const runs = new Map<ConversationId, Run>();
// Inputs placed in this process: a run that starts with one began here, any
// other was resumed after a restart.
const placed = new Set<string>();
let watching: Promise<void> | undefined;

/** Follows every session's runs for good, from startup. */
export function watchRunTelemetry() {
  return (watching ??= (async () => {
    if (offForGood()) return;
    const harness = await getHarness();
    harness.subscribeCommits(({ changes }) => {
      try {
        if (telemetryOn()) committed(changes);
      } catch (error) {
        console.error('[telemetry]', error);
      }
    });
  })());
}

function committed(changes: readonly CommitChange[]) {
  // Change order within a commit is unspecified: inputs first, then entries,
  // so a run that ends in the commit of its last answer still counts it.
  for (const change of changes)
    if (change.type === 'submission' && change.value.type === 'input') {
      const { id, status } = change.value;
      if (status === 'placed') placed.add(String(id));
      else if (status !== 'queued') placed.delete(String(id));
    }
  for (const change of changes)
    if (change.type === 'entry') entry(change.value);
  for (const change of changes)
    if (
      change.type === 'document' &&
      change.record.kind === 'pi.live' &&
      change.conversationId !== undefined
    )
      live(change.conversationId, (change.value as LiveState | null)?.run);
}

function live(id: ConversationId, run: LiveState['run']) {
  const first = run?.inputs[0];
  const key = first === undefined ? undefined : String(first);
  const current = runs.get(id);
  if (current?.key === key) return;
  if (current) {
    runs.delete(id);
    void ended(id, current).catch((error) =>
      console.error('[telemetry]', error),
    );
  }
  if (key === undefined) return;
  runs.set(id, {
    key,
    startedAt: Date.now(),
    resumed: !placed.has(key),
    turns: 0,
    compactions: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
    calls: new Map(),
    repeats: new Map(),
    all: tally(),
    tools: new Map(),
  });
  placed.delete(key);
}

function entry(record: EntryRecord) {
  const run = runs.get(record.conversationId);
  if (!run) return;
  if (AssistantEntry.is(record)) {
    const message = record.model?.[0] as AssistantMessage | undefined;
    if (message?.role === 'assistant')
      answered(record.conversationId, run, message);
  } else if (ToolResultEntry.is(record)) {
    const message = record.model?.[0] as ToolResultMessage | undefined;
    if (message?.role === 'toolResult') toolDone(run, message);
  } else if (CompactionEntry.is(record)) run.compactions++;
}

function answered(id: ConversationId, run: Run, message: AssistantMessage) {
  run.turns++;
  const usage: Partial<Usage> = message.usage ?? {};
  run.usage.input += usage.input ?? 0;
  run.usage.output += usage.output ?? 0;
  run.usage.cacheRead += usage.cacheRead ?? 0;
  run.usage.cacheWrite += usage.cacheWrite ?? 0;
  run.usage.cost += usage.cost?.total ?? 0;
  run.model = {
    provider: message.provider,
    id: message.model,
    thinkingLevel: message.thinkingLevel,
  };
  run.last = { stopReason: message.stopReason };
  for (const block of message.content ?? [])
    if (block.type === 'toolCall')
      run.calls.set(block.id, {
        name: block.name,
        repeat: repeatKey(block.name, JSON.stringify(block.arguments ?? {})),
      });
  const model = publicModel(message.provider, message.model);
  const runHash = hashId(run.key);
  void agentOf(id)
    .then((agent) =>
      track('$ai_generation', {
        $ai_trace_id: runHash,
        $ai_session_id: hashId(String(id)),
        $ai_model: model.id,
        $ai_provider: model.provider,
        $ai_input_tokens: usage.input ?? 0,
        $ai_output_tokens: usage.output ?? 0,
        $ai_cache_read_input_tokens: usage.cacheRead ?? 0,
        $ai_cache_creation_input_tokens: usage.cacheWrite ?? 0,
        ...(message.durationMs !== undefined && {
          $ai_latency: message.durationMs / 1000,
        }),
        $ai_stop_reason: message.stopReason,
        $ai_is_error: message.stopReason === 'error',
        $ai_total_cost_usd: usage.cost?.total ?? 0,
        agent,
      }),
    )
    .catch((error) => console.error('[telemetry]', error));
}

function toolDone(run: Run, message: ToolResultMessage) {
  // A code mode script's calls ran before its own result.
  const details = message.details as { calls?: unknown } | undefined;
  if (Array.isArray(details?.calls))
    for (const call of details.calls as {
      name?: unknown;
      args?: unknown;
      status?: unknown;
      durationMs?: unknown;
    }[])
      if (typeof call?.name === 'string')
        count(run, call.name, {
          nested: true,
          isError: call.status === 'error',
          durationMs: typeof call.durationMs === 'number' ? call.durationMs : 0,
          repeat:
            typeof call.args === 'string'
              ? repeatKey(call.name, call.args)
              : undefined,
        });
  const call = run.calls.get(message.toolCallId);
  count(run, message.toolName, {
    nested: false,
    isError: message.isError,
    durationMs: message.durationMs ?? 0,
    repeat: call?.repeat,
  });
  run.last = { tool: message.toolName, isError: message.isError };
}

function count(
  run: Run,
  name: string,
  call: {
    nested: boolean;
    isError: boolean;
    durationMs: number;
    repeat: number | bigint | undefined;
  },
) {
  const tool = publicTool(name);
  let t = run.tools.get(tool);
  if (!t) run.tools.set(tool, (t = { ...tally(), totalMs: 0, maxMs: 0 }));
  t.totalMs += call.durationMs;
  t.maxMs = Math.max(t.maxMs, call.durationMs);
  const repeats =
    call.repeat === undefined
      ? 1
      : run.repeats
          .set(call.repeat, (run.repeats.get(call.repeat) ?? 0) + 1)
          .get(call.repeat)!;
  for (const each of [run.all, t]) {
    each.calls++;
    if (call.nested) each.nested++;
    if (call.isError) {
      each.errors++;
      each.maxStreak = Math.max(each.maxStreak, ++each.streak);
    } else each.streak = 0;
    each.maxRepeat = Math.max(each.maxRepeat, repeats);
  }
}

async function ended(id: ConversationId, run: Run) {
  const [agent, choice] = await Promise.all([
    agentOf(id),
    (await getHarness()).snapshot(AgentDoc, id, context),
  ]);
  const ref = run.model ?? {
    provider: choice?.model?.provider ?? 'custom',
    id: choice?.model?.modelId ?? 'custom',
  };
  const model = publicModel(ref.provider, ref.id);
  const outcome = outcomeOf(run);
  const runHash = hashId(run.key);
  track('run_end', {
    agent,
    session_hash: hashId(String(id)),
    run_hash: runHash,
    model_provider: model.provider,
    model_id: model.id,
    thinking_level: (run.model?.thinkingLevel ?? choice?.thinkingLevel) as
      | ThinkingLevel
      | undefined,
    outcome,
    is_resumed: run.resumed,
    duration_ms: Date.now() - run.startedAt,
    turn_count: run.turns,
    tool_call_count: run.all.calls,
    nested_tool_call_count: run.all.nested,
    tool_error_count: run.all.errors,
    max_consecutive_tool_errors: run.all.maxStreak,
    max_repeat_call_count: run.all.maxRepeat,
    input_tokens: run.usage.input,
    output_tokens: run.usage.output,
    cache_read_tokens: run.usage.cacheRead,
    cache_write_tokens: run.usage.cacheWrite,
    cost_usd: run.usage.cost,
    compaction_count: run.compactions,
  });
  for (const [tool, t] of run.tools)
    track('tool_use', {
      tool_name: tool,
      call_count: t.calls,
      nested_call_count: t.nested,
      error_count: t.errors,
      duration_ms_total: t.totalMs,
      duration_ms_max: t.maxMs,
      max_consecutive_errors: t.maxStreak,
      max_repeat_call_count: t.maxRepeat,
      agent,
      model_id: model.id,
      run_outcome: outcome,
      run_hash: runHash,
    });
}

/**
 * How the run ended, the way a session's status reads it
 * (shared/src/transcript.ts): an answered `ask` waits for the user, and a run
 * that stops on a tool result was stopped.
 */
function outcomeOf({ last }: Run): RunOutcome {
  if (!last) return 'aborted';
  if ('tool' in last)
    return last.tool === ASK && !last.isError ? 'waiting' : 'aborted';
  if (last.stopReason === 'error') return 'error';
  if (last.stopReason === 'aborted') return 'aborted';
  return 'done';
}

function tally(): Tally {
  return {
    calls: 0,
    nested: 0,
    errors: 0,
    streak: 0,
    maxStreak: 0,
    maxRepeat: 0,
  };
}

function repeatKey(name: string, args: string) {
  return Bun.hash(`${name}\0${args}`);
}

async function agentOf(id: ConversationId) {
  return agentIdOf(await sessionMeta(id));
}

let ownTools: Set<string> | undefined;

/** Bica's own tool names pass; a name a model made up, or a future MCP tool's, could say anything. */
function publicTool(name: string) {
  ownTools ??= new Set(
    registry
      .snapshot()
      .tools()
      .map(({ tool }) => tool.name),
  );
  return ownTools.has(name) ? name : 'other';
}

let catalog: Map<string, Set<string>> | undefined;

/**
 * Pi-ai's own providers and models pass; anything else, which only the user
 * could have named, is 'custom'. A second account of a plan counts as the plan.
 */
export function publicModel(provider: string, id: string) {
  catalog ??= new Map(
    getBuiltinProviders().map((p) => [
      p as string,
      new Set(getAllBuiltinModels(p).map((m) => m.id)),
    ]),
  );
  const base = baseOf(provider);
  const models = catalog.get(base);
  if (!models) return { provider: 'custom', id: 'custom' };
  return { provider: base, id: models.has(id) ? id : 'custom' };
}
