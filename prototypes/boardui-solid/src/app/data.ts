// Fake data for the mock Bica screen. Names are made up.

export type SessionStatus = 'running' | 'waiting' | 'idle' | 'error' | 'done';

export type Session = {
  id: string;
  title: string;
  status: SessionStatus;
  time: string;
  branch?: string;
};
export type Project = { id: string; name: string; sessions: Session[] };

export const PROJECTS: Project[] = [
  {
    id: 'bica',
    name: 'bica',
    sessions: [
      {
        id: 's1',
        title: 'Port BoardUI to Solid',
        status: 'running',
        time: '2m',
        branch: 'boardui-port',
      },
      {
        id: 's2',
        title: 'Fix composer jump on iOS',
        status: 'waiting',
        time: '14m',
        branch: 'ios-composer',
      },
      {
        id: 's3',
        title: 'Tree view for kept files',
        status: 'done',
        time: '1h',
      },
      {
        id: 's4',
        title: 'Flaky socket reconnect test',
        status: 'error',
        time: '3h',
        branch: 'socket-retry',
      },
    ],
  },
  {
    id: 'pierre',
    name: 'pierre-playground',
    sessions: [
      {
        id: 's5',
        title: 'Diff themes from tokens',
        status: 'idle',
        time: 'Mon',
      },
      {
        id: 's6',
        title: 'Split view on tablets',
        status: 'running',
        time: '6m',
      },
    ],
  },
  {
    id: 'site',
    name: 'bica.sh',
    sessions: [
      {
        id: 's7',
        title: 'Docs page for night runs',
        status: 'idle',
        time: 'Sun',
      },
    ],
  },
];

export type Tool = {
  id: string;
  name: string;
  /** Short description of the arguments, shown on the collapsed row. */
  target: string;
  output: string;
  ms: number;
  /** Lines added and removed, for edits. */
  diff?: [number, number];
};

export type Step = { label: string; state: 'done' | 'active' | 'pending' };

export type Turn =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tools'; tools: Tool[] }
  | { kind: 'progress'; steps: Step[] };

export const HISTORY: Turn[] = [
  {
    kind: 'user',
    text: 'Clone the BoardUI free repo and port its tokens into a Tailwind v4 theme for the prototype.',
  },
  {
    kind: 'tools',
    tools: [
      {
        id: 't1',
        name: 'bash',
        target:
          'git clone --depth 1 https://github.com/BoardUI/boardui /tmp/boardui',
        output:
          "Cloning into '/tmp/boardui'...\nReceiving objects: 100% (412/412), done.",
        ms: 2140,
      },
      {
        id: 't2',
        name: 'read',
        target: 'styles/theme.css',
        output:
          '@theme {\n  --color-accent-500: var(--color-blue-500);\n  --radius-2lg: 10px;\n  …',
        ms: 12,
      },
      {
        id: 't3',
        name: 'write',
        target: 'src/styles/theme.css',
        output: 'Wrote 958 lines.',
        ms: 8,
        diff: [958, 0],
      },
    ],
  },
  {
    kind: 'assistant',
    text: [
      'The tokens are in. BoardUI layers them the way Tailwind v4 expects:',
      '',
      '1. **Primitives** in `@theme`: the default palette plus an `accent-*` ramp that points at blue.',
      '2. **Semantic tokens** on `:root`, flipped by a `.dark` class, such as `--color-background-secondary-default`.',
      '3. An `@theme inline` block that turns each semantic token into a utility.',
      '',
      'One thing to watch: dark mode is a **class**, not `light-dark()`, so a page shows one theme unless a region opts into `.dark`.',
    ].join('\n'),
  },
];

/** The scripted turn the mock plays after a prompt. */
export const SCRIPT = {
  tools: [
    {
      id: 'n1',
      name: 'grep',
      target: '"bg-button-primary" src/',
      output: 'src/ui/buttons.tsx:41\nsrc/app/Composer.tsx:118',
      ms: 64,
    },
    {
      id: 'n2',
      name: 'read',
      target: 'src/ui/buttons.tsx',
      output: 'export function Button(props: ButtonProps) {\n  …',
      ms: 9,
    },
    {
      id: 'n3',
      name: 'edit',
      target: 'src/ui/buttons.tsx',
      output:
        '- const p = props;\n+ const p = merge({ variant: "primary" }, props);',
      ms: 15,
      diff: [6, 2],
    },
  ] satisfies Tool[],
  steps: [
    'Find every gradient button',
    'Swap React props for merge()',
    'Check light and dark',
    'Run the type checker',
  ],
  reply: [
    'Done. Every button now reads its defaults through `merge()`, so a missing prop falls back the way React default parameters did.',
    '',
    'A few notes from the port:',
    '',
    '- `className` became `class`, and `cx()` still dedupes conflicting utilities.',
    '- React Aria render props such as `isHovered` turned into plain `hover:` and `focus-visible:` variants.',
    '- The gradient hover uses a `::before` layer, which works the same in Solid since it is pure CSS.',
    '',
    '```tsx',
    "const p = merge({ variant: 'primary', size: 'medium' }, props);",
    "const rest = omit(p, 'variant', 'size', 'class');",
    '```',
    '',
    'Light and dark both look right in the gallery.',
  ].join('\n'),
};
