// Seeds one session that exercises every transcript shape: markdown,
// thinking, single and parallel tool calls (read, bash, write, edit),
// a failing tool, and an error. Tools run for real in a scratch folder.
//
//   bun packages/server/scripts/demo-session.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import {
  fauxAssistantMessage as reply,
  fauxProvider,
  fauxText as text,
  fauxThinking as thinking,
  fauxToolCall as call,
} from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { createRegistry, defineDoc, Harness } from '@earendil-works/pi-durable';
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { CodingTools } from '@earendil-works/pi-durable/tools';

const cwd = '/tmp/bica-demo';
mkdirSync(`${cwd}/src`, { recursive: true });
writeFileSync(
  `${cwd}/src/math.ts`,
  `export function add(a: number, b: number) {\n  return a + b;\n}\n\nexport function div(a: number, b: number) {\n  return a / b;\n}\n`,
);
writeFileSync(`${cwd}/README.md`, '# Demo\n\nA tiny math lib.\n');

const MARKDOWN = `# Heading 1
## Heading 2
### Heading 3

Plain paragraph with **bold**, *italic*, ~~strike~~, \`inline code\`, and a [link](https://example.com).

- bullet one
- bullet two
  - nested bullet
1. first
2. second

> A blockquote that goes on for a while so it wraps onto a second line on narrow screens.

| File | Lines | Status |
| --- | ---: | :---: |
| src/math.ts | 7 | ✅ |
| README.md | 3 | ✏️ |

\`\`\`ts
export function div(a: number, b: number) {
  if (b === 0) throw new Error('division by zero');
  return a / b;
}
\`\`\`

---

- [x] task done
- [ ] task open`;

const steps = [
  reply(
    [
      text('Let me look at the code first.'),
      call('read', { path: 'src/math.ts' }),
    ],
    { stopReason: 'toolUse' },
  ),
  reply(MARKDOWN),
  reply(
    [
      thinking(
        'The user wants a fix. I should check tests and git status in parallel, then patch div().',
      ),
      text('Running a few things in parallel:'),
      call('bash', { command: 'ls -la && echo "---" && cat README.md' }),
      call('read', { path: 'README.md' }),
      call('bash', { command: 'cat does-not-exist.txt' }),
    ],
    { stopReason: 'toolUse' },
  ),
  reply(
    [
      call('write', {
        path: 'src/math.test.ts',
        content:
          "import { div } from './math';\n\nconsole.assert(div(4, 2) === 2);\n",
      }),
      call('edit', {
        path: 'src/math.ts',
        edits: [
          {
            oldText: '  return a / b;',
            newText:
              "  if (b === 0) throw new Error('division by zero');\n  return a / b;",
          },
        ],
      }),
    ],
    { stopReason: 'toolUse' },
  ),
  reply([call('bash', { command: 'seq 1 60 | sed "s/^/line /"' })], {
    stopReason: 'toolUse',
  }),
  reply('Done. `div` now throws on zero, and I added `src/math.test.ts`.'),
  reply([text('Trying the network…')], {
    stopReason: 'error',
    errorMessage: '429 Too Many Requests: rate limit exceeded',
  }),
];

const faux = fauxProvider({
  provider: 'demo',
  models: [{ id: 'demo' }],
  tokensPerSecond: 100_000,
});
faux.setResponses(steps);
const models = builtinModels();
models.setProvider(faux.provider);
const registry = createRegistry();
registry.install(CodingTools);

const harness = await Harness.open(
  await openNodeSqliteStorage('.data/harness.sqlite'),
  {
    models,
    registry,
    env: ({ cwd }) => new NodeExecutionEnv({ cwd: cwd ?? process.cwd() }),
    onReport: console.error,
  },
  context,
);

// Same shape as server/src/sessions.ts.
const SessionDoc = defineDoc<{
  title: string;
  createdAt: number;
  projectId?: string;
}>({
  kind: 'bica.session',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({ title: '', createdAt: 0 }),
  checkpointWhen: () => false,
});

const conversation = await harness.createConversation(
  {
    ownership: { kind: 'ownerless' },
    agent: { model: { provider: 'demo', modelId: 'demo' }, cwd },
    init: async (tx, id) => {
      const doc = await tx.doc(SessionDoc, id);
      doc.title = 'Demo: rendering every transcript shape';
      doc.createdAt = Date.now();
    },
  },
  context,
);

for (const content of [
  'Show me every **markdown** feature you can render.',
  'Fix division by zero.\nAlso add a test.',
  'Now call the API.',
]) {
  const submission = await conversation.submit(
    { type: 'input', content },
    context,
  );
  const settled = await submission.wait(context);
  console.log(content.split('\n')[0], '→', settled.status);
}

console.log(
  `Session ${conversation.id}: http://localhost:3142/s/${conversation.id}`,
);
process.exit(0);
