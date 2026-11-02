import { afterAll, beforeAll, expect, test } from 'bun:test';
import { homedir } from 'node:os';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { startBica, type Bica, type Tab } from '../testing/bica';
import { fakePostHog, type FakePostHog } from '../testing/posthog';

// Before startBica points HOME at a scratch folder.
const home = homedir();
const PROMPT = 'Look for the word zebra-prompt in the files';

let posthog: FakePostHog;
let bica: Bica;
beforeAll(async () => {
  posthog = await fakePostHog();
  bica = await startBica({
    env: { BICA_POSTHOG_KEY: 'phc_test', BICA_POSTHOG_HOST: posthog.url },
  });
});
afterAll(() => posthog?.stop());

function call(name: string, args: Record<string, unknown>) {
  return fauxAssistantMessage(
    fauxToolCall(name, { ...args, summary: 'Look around' }),
    { stopReason: 'toolUse' },
  );
}

async function run(tab: Tab, projectId: string, status: string) {
  const { id } = await tab.request('session.create', {
    projectId,
    prompt: PROMPT,
    requestId: crypto.randomUUID(),
  });
  await tab
    .watch('sessions', {})
    .until((l) => l.some((s) => s.id === id && s.status === status));
}

test("runs reach PostHog as counts of turns, tools, errors, and repeats, without the session's words, arguments, or paths", async () => {
  const tab = await bica.connect();
  const { projectId, cwd } = await bica.project(tab, 'zebra-project');
  const failing = { command: 'echo zebra-argument; exit 3' };
  bica.reply(
    call('bash', failing),
    call('bash', failing),
    // Pi Durable answers a tool that doesn't exist with an error itself.
    call('zebra_tool', {}),
    call('codemode', {
      code: 'console.log((await tools.bash({ command: "echo zebra-nested" })).output)',
    }),
    fauxAssistantMessage('zebra-reply: nothing found'),
  );
  await run(tab, projectId, 'done');
  // A run that asks the user waits for them.
  bica.reply(
    call('ask', {
      questions: [
        {
          question: 'Which zebra?',
          header: 'Zebra',
          options: [{ label: 'Plains' }, { label: 'Mountain' }],
        },
      ],
    }),
  );
  await run(tab, projectId, 'waiting');
  await bica.stop();

  const events = posthog.events();
  const runs = events.filter((e) => e.event === 'run_end');
  expect(runs.map((e) => e.properties.outcome)).toEqual(['done', 'waiting']);
  const done = runs[0]!.properties;
  expect(done).toMatchObject({
    agent: 'coding',
    // The test's own model isn't one of pi-ai's.
    model_provider: 'custom',
    model_id: 'custom',
    is_resumed: false,
    turn_count: 5,
    tool_call_count: 5,
    nested_tool_call_count: 1,
    tool_error_count: 3,
    max_consecutive_tool_errors: 3,
    max_repeat_call_count: 2,
    compaction_count: 0,
  });

  const tools = Object.fromEntries(
    events
      .filter(
        (e) =>
          e.event === 'tool_use' && e.properties.run_hash === done.run_hash,
      )
      .map((e) => [e.properties.tool_name, e.properties]),
  );
  expect(Object.keys(tools).sort()).toEqual(['bash', 'codemode', 'other']);
  expect(tools.bash).toMatchObject({
    call_count: 3,
    nested_call_count: 1,
    error_count: 2,
    max_consecutive_errors: 2,
    max_repeat_call_count: 2,
    run_outcome: 'done',
  });
  expect(tools.other).toMatchObject({ call_count: 1, error_count: 1 });
  expect(tools.codemode).toMatchObject({ call_count: 1, error_count: 0 });

  const generations = events.filter(
    (e) =>
      e.event === '$ai_generation' &&
      e.properties.$ai_trace_id === done.run_hash,
  );
  expect(generations).toHaveLength(5);
  expect(generations[0]!.properties).toMatchObject({
    $ai_session_id: done.session_hash,
    $ai_is_error: false,
  });
  for (const e of generations) {
    expect(e.properties.$ai_input).toBeUndefined();
    expect(e.properties.$ai_output_choices).toBeUndefined();
  }

  const sent = JSON.stringify(posthog.requests);
  expect(sent).not.toContain('zebra');
  expect(sent).not.toContain(cwd);
  expect(sent).not.toContain(bica.root);
  expect(sent).not.toContain(home);
});
