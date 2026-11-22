import { afterAll, beforeAll, expect, test } from 'bun:test';
import type { Context } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import type { ProjectedView } from '@bica/shared/projection';
import { requestOf } from '@bica/shared/requests';
import { shows, startBica, type Bica } from '../testing/bica';

// A fake Composio with Gmail connected: it asks before any tool not hinted
// read-only, as Bica's session config tells the real one to.
const HINTS: Record<string, string> = {
  GMAIL_FETCH_EMAILS: 'readOnlyHint',
  GMAIL_SEND_EMAIL: 'createHint',
  GMAIL_DELETE_MESSAGE: 'destructiveHint',
};
const ran: string[] = [];

type Call = {
  tool_slug: string;
  arguments: Record<string, string>;
  account?: string;
};
// What the last session Bica made asked of Composio.
let sessionConfig: { multi_account?: { enable?: boolean } } = {};

const composio = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname.replace('/api/v3.1', '');
    const body = (req.method === 'POST' ? await req.json() : {}) as {
      arguments?: { tools: Call[] };
      input_responses?: Record<string, { content: { decision: string } }>;
    };
    if (path === '/tool_router/session') {
      sessionConfig = body as typeof sessionConfig;
      return Response.json({ session_id: 'trs_test' });
    }
    // Two Gmail accounts, as Composio lists them.
    if (path === '/connected_accounts')
      return Response.json({
        items: [
          ['ca_home', 'gmail_home-word', 'ana@example.com'],
          ['ca_work', 'gmail_work-word', 'ana@work.example'],
        ].map(([id, word, email]) => ({
          id,
          word_id: word,
          status: 'ACTIVE',
          toolkit: { slug: 'gmail' },
          created_at: new Date().toISOString(),
          state: { val: { displayName: email } },
        })),
      });
    if (path === '/toolkits/gmail')
      return Response.json({ slug: 'gmail', name: 'Gmail', meta: {} });
    const tool = /^\/tools\/(\w+)$/.exec(path)?.[1];
    if (tool)
      return Response.json({
        tags: [HINTS[tool]],
        // As the real one does: the name is the slug, the toolkit has the name.
        toolkit: { slug: 'gmail', name: 'gmail' },
      });
    if (path === '/tool_router/session/trs_test/execute_meta') {
      const calls = body.arguments?.tools ?? [];
      const gated = calls.filter((c) => HINTS[c.tool_slug] !== 'readOnlyHint');
      const answers = body.input_responses;
      if (gated.length && !answers)
        return Response.json({
          result_type: 'input_required',
          request_state: 'state',
          input_requests: Object.fromEntries(
            gated.map((c, i) => [
              `elicit_${i}`,
              {
                type: 'elicitation',
                message: `Your agent wants to run the following tool${c.account ? ` on your "${c.account}" account` : ''}:\n\n${c.tool_slug}(${JSON.stringify(c.arguments)})`,
                requested_schema: {
                  properties: {
                    decision: {
                      oneOf: [
                        { const: 'approve', title: 'Approve' },
                        { const: 'always_approve', title: 'Always approve' },
                        { const: 'deny', title: 'Deny' },
                      ],
                    },
                  },
                },
              },
            ]),
          ),
        });
      const denied = Object.values(answers ?? {}).some(
        (a) => a.content.decision === 'deny',
      );
      return Response.json({
        result_type: 'completed',
        data: {
          results: calls.map((c, index) => {
            if (denied && HINTS[c.tool_slug] !== 'readOnlyHint')
              return { index, error: 'The user denied this call' };
            ran.push(c.tool_slug);
            return { index, response: { data: `ran ${c.tool_slug}` } };
          }),
        },
      });
    }
    return new Response('Not found', { status: 404 });
  },
});

let bica: Bica;
beforeAll(async () => {
  process.env.BICA_COMPOSIO_URL = `http://127.0.0.1:${composio.port}`;
  bica = await startBica();
  const tab = await bica.connect();
  await tab.request('connector.key', { key: 'ak_test_key' });
});
afterAll(async () => {
  await bica?.stop();
  await composio.stop(true);
});

/** A read from a codemode script, as the prompt asks. */
function readApps(...tools: Call[]) {
  return fauxAssistantMessage(
    fauxToolCall('codemode', {
      code: `return JSON.stringify(await tools.composio_multi_execute_tool({ tools: ${JSON.stringify(tools)} }));`,
      summary: 'Read Gmail',
    }),
    { stopReason: 'toolUse' },
  );
}

/** A write as a direct tool call, so it gets its own row. */
function writeApps(...tools: Call[]) {
  return fauxAssistantMessage(
    fauxToolCall('composio_multi_execute_tool', {
      tools,
      summary: 'Use Gmail',
    }),
    { stopReason: 'toolUse' },
  );
}

test("a session's prompt names the connected apps and each one's accounts", async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'apps-prompt');
  let request: Context | undefined;
  bica.reply((context: Context) => {
    // The system prompt travels as the request's system messages.
    request = context;
    return fauxAssistantMessage('Seen');
  });
  const { id } = await tab.request('session.create', {
    projectId,
    prompt: 'Which apps do I have?',
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.id === id && s.status === 'done'));
  expect(
    shows(
      request,
      'Connected apps: Gmail (ana@example.com, ana@work.example).',
    ),
  ).toBe(true);
  expect(shows(request, 'tools.composio_search_tools(')).toBe(true);
});

test('a read runs at once, and a send or a delete ends the turn on a card that runs it once approved', async () => {
  const tab = await bica.connect();
  const { projectId } = await bica.project(tab, 'apps-approval');
  const cases = [
    { tool: 'GMAIL_SEND_EMAIL', answer: 'approve', danger: false },
    { tool: 'GMAIL_DELETE_MESSAGE', answer: 'deny', danger: true },
    // Writing to the session instead leaves the card unanswered.
    { tool: 'GMAIL_SEND_EMAIL', answer: 'Actually, wait', danger: false },
  ];
  for (const c of cases) {
    ran.length = 0;
    bica.reply(
      readApps({ tool_slug: 'GMAIL_FETCH_EMAILS', arguments: {} }),
      writeApps({
        tool_slug: c.tool,
        arguments: { to: 'priya@example.com', subject: 'Q3 numbers' },
        account: 'gmail_work-word',
      }),
      fauxAssistantMessage('All done'),
    );
    const { id } = await tab.request('session.create', {
      projectId,
      prompt: `Read my mail, then ${c.tool}`,
      requestId: crypto.randomUUID(),
    });
    const sessions = tab.watch('sessions', {});
    await sessions.until((l) =>
      l.some((s) => s.id === id && s.status === 'waiting'),
    );
    // The read ran without asking; the gated call waits, with nothing running.
    expect(ran).toEqual(['GMAIL_FETCH_EMAILS']);
    // Without it, Composio's session sees only the newest Gmail.
    expect(sessionConfig.multi_account?.enable).toBe(true);
    const conversation = tab.watch('conversation', { id });
    const card = requestIn(
      (await conversation.until((v) => !!v && !!requestIn(v)))!,
    )!;
    expect(card.request.danger).toBe(c.danger);
    expect(card.request.items[0]).toMatchObject({
      tool: c.tool,
      app: 'Gmail',
      account: 'ana@work.example',
      args: { to: 'priya@example.com' },
    });
    expect(card.request.choices.some((x) => x.value === 'always_approve')).toBe(
      !c.danger,
    );

    const typed = !['approve', 'deny'].includes(c.answer);
    if (typed)
      await tab.request('session.submit', {
        id,
        prompt: c.answer,
        requestId: crypto.randomUUID(),
      });
    else
      await tab.request('request.answer', {
        session: id,
        call: card.call,
        value: c.answer,
      });
    await sessions.until((l) =>
      l.some((s) => s.id === id && s.status === 'done'),
    );
    expect(ran.includes(c.tool)).toBe(c.answer === 'approve');
    if (typed) {
      const late = await tab
        .request('request.answer', {
          session: id,
          call: card.call,
          value: 'approve',
        })
        .then(
          () => 'answered',
          (error: Error) => error.message,
        );
      expect(late).toContain('no longer open');
      expect(ran.includes(c.tool)).toBe(false);
      continue;
    }
    // The agent reads what the user chose, and the result of the call.
    const view = await conversation.until((v) =>
      shows(
        v,
        `The user chose "${c.answer === 'approve' ? 'Approve' : 'Deny'}"`,
      ),
    );
    expect(
      shows(view, c.answer === 'approve' ? `ran ${c.tool}` : "didn't run"),
    ).toBe(true);
  }
});

/** The approval the session waits on, read from its transcript. */
function requestIn(view: ProjectedView | null) {
  for (const entry of view?.entries ?? [])
    for (const m of entry.model ?? []) {
      const request = requestOf(m);
      if (m.role === 'toolResult' && request && request !== 'question')
        return { call: m.toolCallId, request };
    }
  return undefined;
}
