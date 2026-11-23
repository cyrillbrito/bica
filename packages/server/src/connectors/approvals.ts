import type { Context } from '@earendil-works/chord/context';
import type { ToolExecutionApi } from '@earendil-works/pi-durable';

import type { ApprovalItem, ApprovalRequest } from '@bica/shared/requests';
import { onAnswer } from '../sessions/requests';
import { accountNamed } from './apps';
import {
  executeMeta,
  toolInfo,
  toolkitInfo,
  type InputRequest,
  type InputResponse,
  type MetaResult,
} from './composio';

/*
 * Approvals (docs/connectors.md): a call Composio holds for the user's yes
 * ends the run with an approval card, a request like the agent's questions
 * (docs/requests.md). Nothing waits in memory. Once the user approves, the
 * call runs again from what the card kept, and its result reaches the agent
 * in the answer.
 */

// What the card's tool result keeps to run the call once approved.
type Held = { slug: string; args: object; field: string };

const WAITING =
  "Not run yet: it waits for the user's approval on a card in the chat. End your turn now. Their choice, and the result if they approve, come in their next message. If they write something else instead, it didn't run: call it again only if they still want it.";

/**
 * Holds a meta tool's call for approval: the tool result shows the card and
 * ends the run.
 */
export async function hold(
  slug: string,
  args: object,
  requests: Record<string, InputRequest>,
  api: ToolExecutionApi,
  context: Context,
) {
  // A nested call's result goes back to its script, which can't wait.
  if (api.callId.includes('/'))
    throw new Error(
      "Not run: it needs the user's approval, which a script can't wait for. Call composio_multi_execute_tool as a tool for anything that creates, updates, or deletes.",
    );
  const agent = await api.agent(context);
  if (!agent.tools.some((t) => t.name === 'ask'))
    throw new Error(
      'Not run: nobody can approve calls in this session, so it stays undone. Say in your reply what you would have done.',
    );
  const list = Object.values(requests);
  const items = await Promise.all(list.map(itemOf));
  const danger = items.some((i) => i.danger);
  const field = fieldOf(list[0]);
  const request: ApprovalRequest = {
    kind: 'approval',
    danger,
    items,
    choices: field.choices.filter(
      (c) => !(danger && c.value === 'always_approve'),
    ),
  };
  const held: Held = { slug, args, field: field.name };
  return {
    output: [{ type: 'text' as const, text: WAITING }],
    details: { request, held } as never,
    structuredOutput: null as never,
    control: { terminate: true },
  };
}

// A call Composio keeps asking about after this many answers is a bug.
const MAX_ROUNDS = 3;

onAnswer('approval', async ({ request, details, value }) => {
  const choice = request.choices.find((c) => c.value === value);
  if (!choice) throw new Error(`Unknown choice ${value}`);
  const held = (details as { held?: Held } | null)?.held;
  if (!held) throw new Error('This card no longer has its call');
  const calls = request.items.map((i) => i.tool ?? 'a call').join(', ');
  const head = `[Answered on the approval card] The user chose "${choice.label}" for ${calls}`;
  if (value === 'deny')
    return {
      label: choice.label,
      text: `${head}, so it didn't run. Don't retry it another way.`,
    };
  try {
    const result = await runApproved(held, request, value);
    return { label: choice.label, text: `${head}, and it ran:\n\n${result}` };
  } catch (error) {
    return {
      label: choice.label,
      text: `${head}, but it failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

/**
 * Runs an approved call. Composio's request_state may be short-lived, as
 * MCP asks of it, so the call starts over and its new questions get the
 * user's answer, as long as they ask about the same calls.
 */
async function runApproved(
  held: Held,
  request: ApprovalRequest,
  value: string,
) {
  const asked = request.items.map(callOf).sort().join('\n');
  let result = await executeMeta(held.slug, held.args);
  for (let round = 0; result.result_type === 'input_required'; round++) {
    if (round >= MAX_ROUNDS)
      throw new Error('Composio kept asking for approval; nothing more ran');
    const requests = Object.entries(result.input_requests);
    const items = await Promise.all(requests.map(([, r]) => itemOf(r)));
    if (items.map(callOf).sort().join('\n') !== asked)
      throw new Error(
        'Composio asked about other calls than the card showed, so nothing ran. Call it again.',
      );
    result = await executeMeta(held.slug, held.args, undefined, {
      input_responses: Object.fromEntries(
        requests.map(([id]) => [
          id,
          {
            action: 'accept',
            content: { [held.field]: value },
          } satisfies InputResponse,
        ]),
      ),
      request_state: result.request_state,
    });
  }
  return JSON.stringify(outcome(result));
}

/** Composio's data from a finished call; throws for a blocked or failed one. */
export function outcome(
  result: Exclude<MetaResult, { result_type: 'input_required' }>,
) {
  // Composio's skill: a block is its policy working, not a failure to retry.
  if (result.result_type === 'blocked')
    throw new Error(
      `Composio's session policy blocked this call, so don't retry it: ${result.message ?? result.reason ?? 'no reason given'}`,
    );
  // The log id is what Composio's dashboard and support look a failure up by.
  if (result.result_type === 'failed')
    throw new Error(
      `Composio failed${result.log_id ? ` (log ${result.log_id})` : ''}: ${result.error ?? JSON.stringify(result.data)}`,
    );
  return result.data ?? null;
}

// One call as the card shows it, to match a new question to the old.
function callOf(item: ApprovalItem) {
  return item.tool
    ? `${item.account ?? ''} ${item.tool} ${JSON.stringify(item.args)}`
    : item.message;
}

// Composio's own fallback, should a question come without a schema.
const DEFAULT_CHOICES = [
  { value: 'approve', label: 'Approve' },
  { value: 'always_approve', label: 'Always approve' },
  { value: 'deny', label: 'Deny' },
];

function fieldOf(request: InputRequest | undefined) {
  const [name, field] = Object.entries(
    request?.requested_schema?.properties ?? {},
  )[0] ?? ['decision', undefined];
  const choices = field?.oneOf?.map((c) => ({
    value: c.const,
    label: c.title ?? c.const,
  }));
  return { name, choices: choices?.length ? choices : DEFAULT_CHOICES };
}

/** One call in the card, read from Composio's "SLUG({...})" text. */
async function itemOf(request: InputRequest): Promise<ApprovalItem> {
  const message = request.message ?? '';
  const match = /([A-Z][A-Z0-9_]+)\((\{[\s\S]*\})\)\s*$/.exec(message);
  // Composio names the account when the app has several: on your "gmail_x" account.
  const accountId = /on your "([^"]+)" account/.exec(message)?.[1];
  const account = accountId
    ? ((await accountNamed(accountId)) ?? accountId)
    : null;
  if (!match)
    return {
      tool: null,
      app: null,
      logo: null,
      account,
      args: null,
      message,
      // Unknown, so treated as the worst.
      danger: true,
    };
  const tool = match[1]!;
  let args: Record<string, unknown> | null = null;
  try {
    args = JSON.parse(match[2]!);
  } catch {}
  const info = await toolInfo(tool);
  // A tool's own record names its toolkit by slug, so the name comes from there.
  const kit = info?.toolkit?.slug ? await toolkitInfo(info.toolkit.slug) : null;
  return {
    tool,
    app: kit?.name ?? info?.toolkit?.name ?? null,
    logo: kit?.meta?.logo ?? info?.toolkit?.logo ?? null,
    account,
    args,
    message,
    danger: info ? !!info.tags?.includes('destructiveHint') : true,
  };
}
