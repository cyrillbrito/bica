// Transcripts for the demo sessions around the main one (chats.ts), so every
// row in the demo sidebar opens onto a believable session.
import type { Block, Turn } from './conversation';

/** Running: an answer mid-stream, its last tool call still going. */
export const streamTerminals: { turns: Turn[]; live: Block[] } = {
  turns: [
    {
      user: 'When an agent runs a long command in a terminal, its output only shows once the command ends. Stream it into the tool row while it runs, like bash already does.',
    },
    {
      agent: [
        {
          think:
            'bash streams through the tool slot output. terminal_read polls the buffer, so it can publish partial output the same way.',
          ms: 3_400,
        },
        {
          tool: 'read',
          args: {
            summary: 'Read how bash streams its output',
            path: 'server/src/coding-tools.ts',
          },
          ms: 10,
        },
        {
          tool: 'read',
          args: {
            summary: 'Read the terminal tools',
            path: 'server/src/terminal-tools.ts',
          },
          ms: 8,
        },
        {
          tool: 'bash',
          args: {
            summary: 'Find where tool output is published',
            command: 'rg -n "onUpdate|details\\(" src/server',
          },
          ms: 140,
        },
      ],
    },
    {
      agent: [
        {
          say: 'bash publishes partial output through `onUpdate`, and the transcript already shows it in the running row. `terminal_read` waits for the output to settle and returns once, so I’ll publish each chunk while it waits.',
        },
        {
          tool: 'edit',
          args: {
            summary: 'Publish terminal output while waiting',
            path: 'server/src/terminal-tools.ts',
            edits: [
              {
                oldText:
                  '    const output = await settle(id, wait);\n    return text(output);\n',
                newText:
                  '    const output = await settle(id, wait, (chunk) =>\n      onUpdate?.({ content: [{ type: "text", text: chunk }] }),\n    );\n    return text(output);\n',
              },
            ],
          },
          ms: 9,
        },
        {
          tool: 'edit',
          args: {
            summary: 'Pass each chunk out of settle',
            path: 'server/src/terminals.ts',
            edits: [
              {
                oldText:
                  'export async function settle(id: string, wait: number) {\n',
                newText:
                  'export async function settle(\n  id: string,\n  wait: number,\n  onChunk?: (chunk: string) => void,\n) {\n',
              },
            ],
          },
          ms: 7,
        },
      ],
    },
  ],
  live: [
    {
      think:
        'The type check passes. Now the restart test, since terminals are restored after a restart.',
      ms: 1_900,
    },
    {
      tool: 'bash',
      args: {
        summary: 'Run the restart recovery checks',
        command: 'bun run test:bun',
      },
      ms: 14_000,
    },
  ],
};

/** Waiting: it found the bug and asks which fix to take. */
export const reconnectQueue: Turn[] = [
  {
    user: 'If my phone loses the connection while a session runs, the follow-ups I queued are gone when it reconnects. Why?',
  },
  {
    agent: [
      {
        think:
          'Queued prompts live in pi.inbox. Is the inbox in the snapshot after a reconnect?',
        ms: 5_100,
      },
      {
        tool: 'read',
        args: {
          summary: 'Read the reconnect path',
          path: 'client/src/socket/socket.ts',
        },
        ms: 9,
      },
      {
        tool: 'read',
        args: {
          summary: 'Read how the queue is shown',
          path: 'src/components/Queue.tsx',
        },
        ms: 6,
      },
      {
        tool: 'bash',
        args: {
          summary: 'Look for where the snapshot skips docs',
          command: 'rg -n "have\\b|kept" server/src/socket.ts',
        },
        ms: 120,
      },
    ],
  },
  {
    agent: [
      {
        say: `Found it. On reconnect the browser sends the entries it already holds, and the server skips them in the snapshot. It skips the documents too, so \`pi.inbox\` with your queued prompts never comes back. The prompts are still on the server and run in order; only the list above the composer is empty.

There are two ways to fix it.`,
      },
      {
        tool: 'ask',
        args: {
          questions: [
            {
              header: 'Fix',
              question: 'How should the queue come back after a reconnect?',
              options: [
                {
                  label: 'Always send documents (Recommended)',
                  description:
                    'The snapshot keeps skipping held entries but always includes documents. A few hundred bytes more per reconnect.',
                },
                {
                  label: 'Re-subscribe to the inbox',
                  description:
                    'The queue gets its own subscription. Smaller snapshots, one more topic to keep in step.',
                },
              ],
            },
          ],
        },
        output: 'Waiting for the user.',
      },
    ],
  },
];

export const releaseNotes: Turn[] = [
  {
    user: 'Write the release notes for 0.9 from the commits since 0.8. Short, for people who use it.',
  },
  {
    agent: [
      {
        tool: 'bash',
        args: {
          summary: 'List the commits since 0.8',
          command: 'git log v0.8..HEAD --oneline --no-merges',
        },
        ms: 60,
      },
      {
        tool: 'read',
        args: { summary: 'Read the previous notes', path: 'CHANGELOG.md' },
        ms: 5,
      },
    ],
  },
  {
    agent: [
      {
        say: `## 0.9

**Voice calls.** Talk to a session hands-free from the phone. It answers out loud, and what was said lands in the transcript.

**Worktrees in one click.** Start a session in a new worktree named after it, and remove merged ones from the sidebar.

**Context you can see.** The meter in the top bar shows what fills the window, what it cost, and when the prompt cache goes cold.

Smaller things:
- Thinking rows fold by default and show how long they took.
- Unread sessions show in the tab title.
- The composer keeps focus after sending.

I left out the internal refactors. Want a line about the new Git panel too?`,
      },
    ],
  },
];

/** Running: a voice call handed work to the session, which is now on it. */
export const voiceHandoff: { turns: Turn[]; live: Block[] } = {
  turns: [
    {
      voice: [
        [
          'you',
          'When I end a call, can it start a new session with what we decided, instead of me typing it again?',
        ],
        [
          'voice',
          'Yes. I can write a short brief from the call and start a session in this project with it. Should it open in a new worktree?',
        ],
        ['you', 'Yes, new worktree, and put the brief at the top.'],
        ['voice', 'Got it. I’ll hand it to the session now.'],
      ],
    },
    {
      user: '[Note from Bica, not from the user] Brief from the voice call: when a call ends, offer to start a new session in a new worktree with a brief of what was decided. The brief goes first in the new session.',
    },
    {
      agent: [
        {
          think:
            'The call already ends through voice.stop. The handoff needs a tool the voice model can call, then session.create with worktree: true.',
          ms: 6_200,
        },
        {
          tool: 'read',
          args: {
            summary: 'Read how calls end',
            path: 'server/src/voice/voice.ts',
          },
          ms: 11,
        },
        {
          tool: 'read',
          args: {
            summary: 'Read how sessions start in a worktree',
            path: 'server/src/sessions.ts',
          },
          ms: 9,
        },
      ],
    },
    {
      agent: [
        {
          say: 'The voice model can already call tools, so the handoff is one more tool: `start_session` with the brief. It calls the same code as the New session button, with a new worktree.',
        },
        {
          tool: 'edit',
          args: {
            summary: 'Add the start_session tool to calls',
            path: 'server/src/voice/voice.ts',
            edits: [
              {
                oldText: 'const TOOLS = [tell, hangUp];\n',
                newText: 'const TOOLS = [tell, hangUp, startSession];\n',
              },
            ],
          },
          ms: 8,
        },
      ],
    },
  ],
  live: [
    {
      say: 'Now the tool itself. It takes the brief, starts the session in a new worktree of the same project, and returns its title so the voice can say where to find it. While I write it, one question for later: should the call',
    },
  ],
};

export const calmerVoice: Turn[] = [
  { user: 'The voice talks too fast and sounds too excited. Make it calmer.' },
  {
    agent: [
      {
        tool: 'read',
        args: {
          summary: 'Read the voice settings',
          path: 'server/src/voice/voice.ts',
        },
        ms: 8,
      },
      {
        tool: 'edit',
        args: {
          summary: 'Slow the default speed and soften the tone',
          path: 'server/src/voice/voice.ts',
          edits: [
            {
              oldText:
                "const SPEED = 1;\nconst TONE = 'Friendly and upbeat.';\n",
              newText:
                "const SPEED = 0.9;\nconst TONE = 'Calm and plain. Short sentences, no exclamations.';\n",
            },
          ],
        },
        ms: 7,
      },
    ],
  },
  {
    agent: [
      {
        say: 'The default speed is now 0.9, and the instructions ask for a calm, plain tone without exclamations. You can still change both per session under Voice in the context menu.',
      },
    ],
  },
  // The user detached it here (data.ts).
  { user: 'Still a bit fast for me. Make it 0.85.' },
  {
    agent: [
      {
        say: 'The default speed is now 0.85. Sessions with their own speed keep it.',
      },
    ],
  },
];

export const blogDraft: Turn[] = [
  {
    user: 'Draft a short post about building Bica with Bica: how I run several agents at once from my phone. Keep my voice: plain, no hype.',
  },
  {
    agent: [
      {
        tool: 'read',
        args: {
          summary: 'Read my last post for tone',
          path: 'posts/why-i-stopped-using-tabs.md',
        },
        ms: 6,
      },
      {
        tool: 'write',
        args: {
          summary: 'Save the draft',
          path: 'posts/building-bica-with-bica.md',
          content:
            '# Building Bica with Bica\n\nMost of Bica was written by agents running inside Bica.\n',
        },
        ms: 5,
      },
    ],
  },
  {
    agent: [
      {
        say: `# Building Bica with Bica

Most of Bica was written by agents running inside Bica. On a normal day there are four or five sessions going, each in its own worktree, and I check on them from my phone between other things.

The loop is simple. I write a prompt, the agent works, and the sidebar shows a dot when it needs me. A blue dot means it's done, an outlined one means it's asking something. I open it, read the answer, look at the diff, and either reply or commit.

What made it work wasn't the model. It was three small things:

1. **One worktree per feature**, so two agents never edit the same file.
2. **Full-size diffs**, so reviewing on a phone isn't squinting.
3. **Queued messages**, so I can add "also check the phone layout" while it's still running.

I wrote it at \`posts/building-bica-with-bica.md\`. It needs a screenshot after the second paragraph.`,
      },
    ],
  },
];

export const sourdough: Turn[] = [
  {
    user: 'I want to start a sourdough starter. Give me a simple daily schedule, I’m home mornings and evenings.',
  },
  {
    agent: [
      {
        say: `Here's a schedule that fits mornings and evenings. Use a clean jar and keep it at room temperature, around 22–25 °C.

| Day | Morning | Evening |
| --- | --- | --- |
| 1 | Mix 50 g whole wheat flour + 50 g water | — |
| 2 | Nothing, let it sit | Discard half, feed 50 g flour + 50 g water |
| 3–4 | Discard half, feed | Discard half, feed |
| 5–7 | Discard half, feed with white flour | Discard half, feed |

It's ready when it doubles within 4–6 hours of a feed and smells pleasantly sour. That's usually day 7 to 10.

If it goes quiet around day 3, that's normal: the first bubbles come from bacteria that die off before the yeast takes over. Keep feeding.`,
      },
    ],
  },
  { user: 'Can I keep it in the fridge once it’s ready?' },
  {
    agent: [
      {
        say: "Yes. Once it's active, feed it, wait an hour, and put it in the fridge. Feed it once a week there. The day before you bake, take it out and give it two feeds at room temperature so it's strong again.",
      },
    ],
  },
];
