// Bica in a process of its own, for tests that kill it:
//   bun server/src/testing/serve.ts <root> <hang | answer text | start-child>
// Prints its port once it listens, `working` once a held answer starts, and
// `asked: <prompt>` for each answer.
import type { Context } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';

import { startBica } from './bica';

const [root, mode, text = ''] = process.argv.slice(2);
const bica = await startBica({ root });

/** The newest prompt or tool result the model answers. */
function lastAsked(context: Context) {
  const last = context.messages.findLast((m) => m.role !== 'system');
  if (!last || last.role === 'assistant') return { role: 'none', text: '' };
  const content = last.content;
  return {
    role: last.role,
    text:
      typeof content === 'string'
        ? content
        : content.map((c) => (c.type === 'text' ? c.text : '')).join(''),
  };
}

if (mode === 'hang')
  void bica.hold().started.then(() => console.log('working'));
else if (mode === 'answer')
  bica.reply(
    ...Array.from({ length: 20 }, () => (context: Context) => {
      console.log(`asked: ${lastAsked(context).text.split('\n')[0]}`);
      return fauxAssistantMessage(text);
    }),
  );
// A session that starts a child, whose answer never comes.
else if (mode === 'start-child')
  bica.reply(
    ...Array.from({ length: 5 }, () => (context: Context) => {
      const asked = lastAsked(context);
      if (asked.role === 'toolResult')
        return fauxAssistantMessage('Started the child.');
      if (asked.text.includes('] Child task')) {
        console.log('working');
        return new Promise<never>(() => {});
      }
      return fauxAssistantMessage(
        fauxToolCall('session_start', { prompt: 'Child task' }),
        { stopReason: 'toolUse' },
      );
    }),
  );
console.log(`port ${bica.port}`);
