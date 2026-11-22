import type { Context } from '@earendil-works/chord/context';
import { arr, obj, oneOf, opt, str, unsafe } from '@earendil-works/pi-schema';
import {
  defineExtension,
  defineTool,
  section,
  type PromptInput,
  type ToolExecutionApi,
} from '@earendil-works/pi-durable';

import { SessionDoc } from '../sessions/session-doc';
import { hold, outcome } from './approvals';
import { executeMeta } from './composio';

/*
 * Composio's meta tools (docs/connectors.md). Search, schemas, and
 * connections are reads, so they're script-only and their schemas stay out
 * of the prompt. The tool that runs app tools is also listed, so every write
 * the user approves is its own approval card in the transcript.
 */

const ANY = unsafe<unknown>({});

/** Runs a meta tool; a call Composio holds for approval ends the run. */
async function run(
  slug: string,
  args: object,
  api: ToolExecutionApi,
  context: Context,
) {
  const result = await executeMeta(slug, args, context.abortSignal);
  if (result.result_type === 'input_required')
    return hold(slug, args, result.input_requests, api, context);
  // Composio's results carry a workflow id it asks to be passed back. It only
  // groups calls in Composio's logs, so it's dropped rather than asked for.
  const { session: _session, ...data } = (outcome(result) ?? {}) as Record<
    string,
    unknown
  >;
  return {
    output: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredOutput: data as never,
  };
}

const search = defineTool({
  name: 'composio_search_tools',
  description:
    "Finds Composio tools for tasks in the user's apps: each query returns tools with their input schemas (or a schemaRef), a recommended plan, known pitfalls, and whether the app is connected. Call it first for every new task.",
  parameters: obj({
    queries: arr(
      obj({
        use_case: str({
          description:
            'One action in plain English, with the app named: "fetch unread Gmail emails". No personal details here.',
        }),
        // Composio wants a string, but models often pass an object.
        known_fields: opt(
          unsafe<string | Record<string, unknown>>({
            description:
              'Known inputs as "key:value, key:value": names, ids, emails',
            type: ['string', 'object'],
          }),
        ),
      }),
      { minItems: 1 },
    ),
    search_strategy: opt(
      oneOf(['auto', 'tool_search'], {
        description:
          'tool_search skips cached plans, when the plan or a tool is missing',
      }),
    ),
  }),
  structuredOutputSchema: ANY,
  callers: ['tools'],
  deferred: true,
  replay: 'safe',
  execute: (args, api, context) =>
    run(
      'COMPOSIO_SEARCH_TOOLS',
      {
        ...args,
        queries: args.queries.map((q) => ({
          ...q,
          known_fields:
            q.known_fields && typeof q.known_fields === 'object'
              ? Object.entries(q.known_fields)
                  .map(([k, v]) => `${k}:${String(v)}`)
                  .join(', ')
              : q.known_fields,
        })),
      },
      api,
      context,
    ),
});

const schemas = defineTool({
  name: 'composio_get_tool_schemas',
  description:
    'Full input schemas of Composio tools by slug, for tools composio_search_tools returned with a schemaRef. Only slugs search returned.',
  parameters: obj({
    tool_slugs: arr(str(), { minItems: 1 }),
  }),
  structuredOutputSchema: ANY,
  callers: ['tools'],
  deferred: true,
  replay: 'safe',
  execute: (args, api, context) =>
    run('COMPOSIO_GET_TOOL_SCHEMAS', args, api, context),
});

const execute = defineTool({
  name: 'composio_multi_execute_tool',
  description:
    "Runs Composio tools in the user's connected apps, up to 50 independent ones at once, with slugs and arguments exactly as composio_search_tools returned them. Returns results[], each with a response or an error. Tools that create, update, or delete wait for the user's approval on a card in the chat, which ends your turn; a denied one is final.",
  parameters: obj(
    {
      tools: arr(
        obj({
          tool_slug: str({
            description: 'A slug composio_search_tools returned',
          }),
          arguments: unsafe<Record<string, unknown>>({
            type: 'object',
            additionalProperties: true,
          }),
        }),
        { minItems: 1, maxItems: 50 },
      ),
    },
    // Takes the summary every listed tool gets (tools/summary.ts).
    { open: true },
  ),
  structuredOutputSchema: ANY,
  // Listed so a write the user approves is its own row; scripts use it for
  // reads, to keep only the fields they need.
  callers: ['model', 'tools'],
  execute: (args, api, context) =>
    run(
      'COMPOSIO_MULTI_EXECUTE_TOOL',
      { ...args, sync_response_to_workbench: false },
      api,
      context,
    ),
});

const connections = defineTool({
  name: 'composio_manage_connections',
  description:
    "Checks the user's connections to apps by toolkit slug, as composio_search_tools names them. For an app that isn't connected it returns a sign-in link (redirect_url): put it in your reply as a Markdown link, and check again once the user says they signed in.",
  parameters: obj({
    toolkits: arr(str(), { minItems: 1 }),
  }),
  structuredOutputSchema: ANY,
  callers: ['tools'],
  deferred: true,
  execute: (args, api, context) =>
    run('COMPOSIO_MANAGE_CONNECTIONS', args, api, context),
});

const GUIDE = `Composio connects you to the user's apps. Find and read with these tools from codemode scripts; codemode doesn't list them, and each resolves to Composio's data as an object:
- \`tools.composio_search_tools({ queries: [{ use_case, known_fields? }] })\`: tools for a task, with input schemas, a plan, pitfalls, and connection status. Search first for every new task.
- \`tools.composio_get_tool_schemas({ tool_slugs })\`: the schemas of tools search returned with a \`schemaRef\`.
- \`tools.composio_manage_connections({ toolkits })\`: a sign-in link for an app that isn't connected. Put it in your reply as a Markdown link.
- \`tools.composio_multi_execute_tool({ tools: [{ tool_slug, arguments }] })\`: runs app tools. Read from a script, so you keep only the fields you need. Call it as a tool, not from a script, for anything that creates, updates, or deletes, so the user sees each one.
Rules:
- Use only toolkit slugs, tool slugs, and argument names that search returned.
- Results are large, so return only what you need: from a search, the plan, the connection status, and the schemas of the tools you'll call; from a list, the fields the answer uses (say each email's sender, subject, and date).
- Connect only the apps the task needs. An app can have two toolkits, such as \`notion\` and \`notion_mcp\`, with separate connections: use the connected one and say which.
- An auth error from a connected app means its sign-in expired: get a new link with composio_manage_connections. A failure names a Composio log id: give it to the user.
- Reads run at once. Tools that create, update, or delete wait for the user's approval on a card in the chat, which ends your turn; their choice comes in their next message. The card does the asking, so don't ask for confirmation in your text too. A denied call is final: don't retry it another way.
- Prefer what can be undone: trash over a permanent delete, archive over delete, a draft over a send. Delete for good only when the user asked for exactly that.
- Send only when the user named what to send and to whom. "Handle my inbox" is not an ask, replying is sending, and anything you weren't asked to send stays a draft.`;

/**
 * The section names the apps connected when the session started or last
 * compacted: a copy kept in SessionDoc (server/src/sessions/prompts.ts), so
 * a new connection doesn't break the prompt cache. Without a key, nothing.
 */
const connectorsSection = section(
  'connectors',
  async (input: PromptInput, context: Context) => {
    const meta = await input.read.snapshot(
      SessionDoc,
      input.conversationId,
      context,
    );
    return meta?.apps ? `${meta.apps}\n\n${GUIDE}` : undefined;
  },
);

export const Connectors = defineExtension({
  name: 'connectors',
  tools: [search, schemas, execute, connections],
  sections: [connectorsSection],
});
