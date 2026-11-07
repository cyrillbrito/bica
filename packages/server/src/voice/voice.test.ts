import { afterAll, beforeAll, expect, test } from 'bun:test';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { toMessages, withCallWords } from '@bica/shared/transcript';
import { shows, startBica, type Bica } from '../testing/bica';

// Voice calls need OpenAI, so this drives the session side of a call
// (server/src/voice/session.ts) directly, where it meets Durable's inbox.
let bica: Bica;
beforeAll(async () => {
  bica = await startBica();
});
afterAll(() => bica?.stop());

test('a spoken correction joins the running work, and the transcript shows it without the call lines', async () => {
  const tab = await bica.connect();
  const { voiceSession } = await import('./session');
  const first = bica.hold(
    fauxAssistantMessage(
      fauxToolCall('bash', { command: 'true', summary: 'Check' }),
      { stopReason: 'toolUse' },
    ),
  );
  bica.reply(fauxAssistantMessage('Fixed on the other branch'));
  const { projectId } = await bica.project(tab);
  const { id } = await tab.request('session.create', {
    projectId,
    prompt: 'Fix the cache bug',
    requestId: crypto.randomUUID(),
  });
  await first.started;

  const call = await voiceSession(id);
  const answer = call.ask(
    withCallWords('No, use the other branch', [
      'User: no wait, use the other branch',
    ]),
  );
  first.release();

  // Joined the run: answered by its one final reply, not a second run.
  expect((await answer).text).toBe('Fixed on the other branch');
  // The call's lines show in the call, so the prompt row leaves them out.
  const view = await tab
    .watch('conversation', { id })
    .until((c) => shows(c, 'Fixed on the other branch'));
  const shown = toMessages(view!);
  expect(shows(shown, 'No, use the other branch')).toBe(true);
  expect(shows(shown, 'no wait')).toBe(false);
});
