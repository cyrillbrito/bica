// Every event the server sends to PostHog, and its properties: adding an
// event means adding it here. docs/telemetry.md says what may be sent; names
// follow PostHog's `object_verb` guide. `track` adds the super properties
// (app, bica_version, install_kind, os, arch) to each.
import type { AgentId } from '@bica/shared/agents';
import type { ThinkingLevel } from '@bica/shared/protocol';

/** A hashed session or run id, from `hashId`: never the raw id. */
export type Hash = string;

/** A text's length as a coarse bucket, from `lengthBucket`. */
export type LengthBucket = '0' | '1-99' | '100-999' | '1k-9k' | '10k+';

export type RunOutcome = 'done' | 'error' | 'aborted' | 'waiting';

export interface Events {
  server_start: { is_new_install: boolean };
  // Once a day, so a server that runs for weeks still counts as active.
  server_heartbeat: {
    project_count: number;
    worktree_count: number;
    open_session_count: number;
    // Sessions with a message in the last day.
    active_session_count: number;
  };

  session_create: {
    agent: AgentId;
    session_hash: Hash;
    is_child: boolean;
    origin: 'user' | 'agent' | 'night' | 'fork' | 'hub';
    is_worktree: boolean;
  };
  session_archive: { agent: AgentId; session_hash: Hash };
  prompt_send: {
    agent: AgentId;
    session_hash: Hash;
    sender: 'user' | 'agent' | 'bica';
    mode: 'prompt' | 'steer' | 'queue';
    has_images: boolean;
    length_bucket: LengthBucket;
  };

  // One per run.
  run_end: {
    agent: AgentId;
    session_hash: Hash;
    run_hash: Hash;
    model_provider: string;
    model_id: string;
    thinking_level: ThinkingLevel;
    outcome: RunOutcome;
    duration_ms: number;
    turn_count: number;
    tool_call_count: number;
    tool_error_count: number;
    max_consecutive_tool_errors: number;
    // The most calls with the same tool and the same arguments in the run.
    max_repeat_call_count: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    cost_usd: number;
    compaction_count?: number;
  };
  // One per tool per run, not per call, to keep the volume low.
  tool_use: {
    // Bica's own tool names; any other name is sent as 'other'.
    tool_name: string;
    call_count: number;
    error_count: number;
    duration_ms_total: number;
    duration_ms_max: number;
    max_consecutive_errors: number;
    max_repeat_call_count: number;
    agent: AgentId;
    model_id: string;
    run_outcome: RunOutcome;
    run_hash: Hash;
  };
  // One per model response, for PostHog's LLM analytics, in privacy mode:
  // never `$ai_input` or `$ai_output_choices`.
  // https://posthog.com/docs/llm-analytics/manual-capture
  $ai_generation: {
    $ai_trace_id: Hash;
    $ai_session_id: Hash;
    $ai_model: string;
    $ai_provider: string;
    $ai_input_tokens: number;
    $ai_output_tokens: number;
    $ai_cache_read_input_tokens?: number;
    $ai_cache_creation_input_tokens?: number;
    // Seconds.
    $ai_latency: number;
    $ai_stop_reason?: string;
    $ai_is_error: boolean;
    $ai_http_status?: number;
    $ai_total_cost_usd?: number;
    agent: AgentId;
  };

  worktree_create: Record<string, never>;
  worktree_remove: { is_forced: boolean };
  commit_create: { is_amend: boolean };
  terminal_start: { by: 'user' | 'agent' };
  voice_call_start: { session_hash: Hash };
  voice_call_end: { session_hash: Hash; duration_ms: number };
  provider_connect: { provider: string; method: 'key' | 'sign_in' };
  night_run_start: { session_hash: Hash };
}

export type EventName = keyof Events;

/** Where one of Bica's own errors came from, sent with its `$exception`. */
export interface ErrorProperties {
  source:
    | 'uncaught_exception'
    | 'unhandled_rejection'
    | 'harness'
    | 'socket_request'
    | 'socket_topic';
  // A socket request's call, or a topic's name.
  call?: string;
  // The harness's report type and what it names: Bica's own task kinds,
  // extensions, and host callbacks.
  report_type?: string;
  task_kind?: string;
  extension?: string;
  callback?: string;
}

export function lengthBucket(length: number): LengthBucket {
  if (length === 0) return '0';
  if (length < 100) return '1-99';
  if (length < 1000) return '100-999';
  if (length < 10_000) return '1k-9k';
  return '10k+';
}
