// Test data for what fills a session's context, the model catalog, the
// settings, the providers in Settings, and plan usage (`?data=demo`, `?data=worst`). Compact
// and pruning play out on the test sessions, so the context field can be
// seen shimmering and clearing.
import { createSignal } from 'solid-js';

import type { UsageState } from '@earendil-works/pi-durable';

import type {
  ContextBreakdown,
  Group,
  Part,
} from '@bica/shared/context-breakdown';
import type { ContextUsage } from '@bica/shared/context-usage';
import type {
  Accounts,
  ModelCatalog,
  PlanUsage,
  Settings,
  ThinkingLevel,
} from '@bica/shared/protocol';

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = Date.now();

const RESERVE = 16_384;
const BACKGROUND = 32_768;

type Shape = 'running' | 'finished' | 'asking';

function part(
  key: string,
  label: string,
  group: Group,
  tokens: number,
  detail?: string,
): Part {
  return { key, label, group, tokens, detail };
}

// Parts per shape: [system, tools, conversation], largest first in each.
function parts(shape: Shape, worst: boolean): Part[] {
  const system = [
    part('instructions', 'Instructions', 'system', 3_100),
    part('project', 'AGENTS.md', 'system', 2_400),
    part(
      'skills',
      'Skills',
      'system',
      1_300,
      worst
        ? 'agent-browser, frontend-design, twg, twg-jira, twg-confluence, twg-engineering-work, ponytail, but, writing'
        : 'agent-browser, frontend-design',
    ),
    part('system', 'Base prompt', 'system', 900),
  ];
  const tools = [
    part('tool:bash', 'bash', 'tools', 2_900),
    part('tool:edit', 'edit', 'tools', 2_100),
    part('tool:codemode', 'codemode', 'tools', 1_800),
    part('tool:read', 'read', 'tools', 1_200),
    part('tool:ask', 'ask', 'tools', 700),
  ];
  // Worst case: the asking one is big and its cache nearly cold, the moment
  // to compact.
  const scale = { running: 1, finished: 1.7, asking: worst ? 1.9 : 0.32 }[
    shape
  ];
  const talk = [
    part('result:read', 'read results', 'conversation', 61_000 * scale),
    part('result:bash', 'bash results', 'conversation', 38_000 * scale),
    part('replies', 'Replies', 'conversation', 21_000 * scale),
    part('thinking', 'Thinking', 'conversation', 17_000 * scale),
    part('calls', 'Tool calls', 'conversation', 9_400 * scale),
    part('prompts', 'Prompts', 'conversation', 4_100 * scale),
    part('images', 'Images', 'conversation', shape === 'asking' ? 0 : 3_200),
  ].filter((p) => p.tokens > 0);
  if (worst)
    talk.push(
      part(
        'result:mcp__northwind__very_long_tool_name_that_never_ends',
        'mcp__northwind__very_long_tool_name_that_never_ends results',
        'conversation',
        44_000,
      ),
    );
  return [...system, ...tools, ...talk].map((p) => ({
    ...p,
    tokens: Math.round(p.tokens / 100) * 100,
  }));
}

function usage(shape: Shape, worst: boolean): ContextUsage & ContextBreakdown {
  const all = parts(shape, worst);
  const used = all.reduce((n, p) => n + p.tokens, 0);
  // The finished one sits on a 1M window, so it can grow past 200k.
  const window =
    shape === 'finished' || (worst && shape === 'asking') ? 1_000_000 : 200_000;
  const compactAt = window - RESERVE;
  const results = all.filter((p) => p.key.startsWith('result:'));
  return {
    used,
    measured: shape !== 'asking',
    window,
    compactAt,
    backgroundAt: compactAt - BACKGROUND,
    parts: all,
    biggest: [
      {
        label: 'read',
        detail: 'src/components/Sidebar.tsx',
        tokens: 14_200,
        target: { call: 'fixture-read' },
      },
      {
        label: 'bash',
        detail: 'bun run check',
        tokens: 9_800,
        target: { call: 'fixture-bash' },
      },
      {
        label: 'Reply',
        detail: 'The sidebar overflowed because the badge row had no min-w-0.',
        tokens: 2_100,
        target: { key: 'fixture-reply' },
      },
    ],
    misses: worst ? 7 : 1,
    // Warm for 4 more minutes when idle, so the countdown shows.
    cache:
      shape === 'running'
        ? undefined
        : {
            at: now - (shape === 'finished' ? 2 * HOUR : 56 * MIN),
            ttl: HOUR,
          },
    compacting: false,
    running: shape === 'running',
    prunable: Math.round(results.reduce((n, p) => n + p.tokens, 0) * 0.74),
  };
}

// Spend per model, as Pi Durable's usage tracking holds it.
function spend(shape: Shape, worst: boolean): UsageState | undefined {
  if (shape === 'asking') return undefined;
  const models = [
    {
      model: 'anthropic/claude-opus-4-5',
      input: 18_000,
      cacheRead: 2_400_000,
      cacheWrite: 210_000,
      output: 41_000,
      cost: 3.86,
    },
    {
      model: 'anthropic/claude-haiku-4-5',
      input: 52_000,
      cacheRead: 120_000,
      cacheWrite: 8_000,
      output: 3_900,
      cost: 0.09,
    },
    {
      model: worst
        ? 'openrouter/qwen/qwen3-coder-480b-a35b-instruct-turbo-preview'
        : 'openai-codex/gpt-5.1-codex',
      input: 640_000,
      cacheRead: 3_100_000,
      cacheWrite: 0,
      output: 22_000,
      cost: 1.42,
    },
  ];
  return {
    models: Object.fromEntries(
      models.map(({ model, cost, ...u }) => [
        model,
        {
          ...u,
          totalTokens: u.input + u.cacheRead + u.cacheWrite + u.output,
          cost: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            total: cost,
          },
        },
      ]),
    ),
    tools: {},
  } as UsageState;
}

/**
 * One session's context, with compaction and pruning that play out: the
 * cells shimmer for a few seconds, then the conversation shrinks.
 */
export function fixtureContext(shape: Shape, worst: boolean) {
  const [value, setValue] = createSignal(usage(shape, worst), {
    name: 'fixtureContext',
  });
  const shrink = (keep: (p: Part) => number) => {
    const v = value();
    const next = v.parts
      .map((p) => ({ ...p, tokens: Math.round(keep(p) / 100) * 100 }))
      .filter((p) => p.tokens > 0);
    const used = next.reduce((n, p) => n + p.tokens, 0);
    setValue({
      ...v,
      parts: next,
      used,
      compacting: false,
      prunable: 0,
      biggest: [],
    });
  };
  return {
    value,
    spend: spend(shape, worst),
    // Like the server: the call answers once it has started.
    compact: async () => {
      setValue((v) => ({ ...v, compacting: true }));
      setTimeout(
        () =>
          shrink((p) =>
            p.group !== 'conversation'
              ? p.tokens
              : p.key === 'replies'
                ? 7_800
                : p.tokens * 0.08,
          ),
        3200,
      );
    },
    prune: async () => {
      await new Promise((r) => setTimeout(r, 1600));
      const v = value();
      const results = v.parts.filter((p) => p.key.startsWith('result:'));
      const total = results.reduce((n, p) => n + p.tokens, 0);
      const share = total ? 1 - v.prunable / total : 1;
      shrink((p) =>
        p.key.startsWith('result:') ? p.tokens * share : p.tokens,
      );
    },
  };
}

const LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high'];
const CLAUDE: ThinkingLevel[] = ['off', 'low', 'medium', 'high', 'max'];
const CODEX: ThinkingLevel[] = ['minimal', 'low', 'medium', 'high', 'xhigh'];

type Model = ModelCatalog['models'][number];
function model(
  provider: string,
  id: string,
  name: string,
  levels: ThinkingLevel[],
  contextWindow: number,
  cost: [input: number, output: number],
): Model {
  return {
    provider,
    id,
    name,
    levels,
    contextWindow,
    cost: { input: cost[0], output: cost[1] },
    cacheTtl: provider === 'anthropic' ? { short: 300, long: 3600 } : {},
  };
}

/** The catalog: list prices from pi-ai's model data, as of writing. */
export function fixtureCatalog(worst: boolean): ModelCatalog {
  const models: Model[] = [
    model(
      'anthropic',
      'claude-opus-4-5',
      'Claude Opus 4.5',
      CLAUDE,
      200_000,
      [5, 25],
    ),
    model(
      'anthropic',
      'claude-sonnet-4-5',
      'Claude Sonnet 4.5',
      CLAUDE,
      1_000_000,
      [3, 15],
    ),
    model(
      'anthropic',
      'claude-haiku-4-5',
      'Claude Haiku 4.5',
      CLAUDE,
      200_000,
      [1, 5],
    ),
    model(
      'openai-codex',
      'gpt-5.1-codex',
      'GPT-5.1 Codex',
      CODEX,
      400_000,
      [1.25, 10],
    ),
    model(
      'openai-codex',
      'gpt-5.1-codex-mini',
      'GPT-5.1 Codex mini',
      CODEX,
      400_000,
      [0.25, 2],
    ),
    model(
      'openrouter',
      'moonshotai/kimi-k2-thinking',
      'Kimi K2 Thinking',
      LEVELS,
      262_144,
      [0.6, 2.5],
    ),
    model(
      'openrouter',
      'z-ai/glm-4.6',
      'GLM 4.6',
      LEVELS,
      202_752,
      [0.4, 1.75],
    ),
    model(
      'openrouter',
      'meta-llama/llama-3.3-70b-instruct',
      'Llama 3.3 70B Instruct',
      [],
      131_072,
      [0.13, 0.39],
    ),
  ];
  if (worst)
    models.push(
      model(
        'openrouter',
        'qwen/qwen3-coder-480b-a35b-instruct-turbo-preview',
        'Qwen: Qwen3 Coder 480B A35B Instruct Turbo (preview, experimental)',
        LEVELS,
        1_048_576,
        [0, 0],
      ),
    );
  return {
    providers: [
      { id: 'anthropic', name: 'Anthropic', source: 'Claude Pro/Max' },
      {
        id: 'openai-codex',
        name: 'OpenAI Codex (legacy)',
        source: 'ChatGPT Plus/Pro',
      },
      { id: 'openrouter', name: 'OpenRouter', source: 'stored credential' },
    ],
    models,
    compaction: { reserveTokens: RESERVE, backgroundTokens: BACKGROUND },
  };
}

export function fixtureAccounts(worst: boolean): Accounts {
  const key = { type: 'api_key' as const, label: 'Add API key' };
  return {
    accounts: [
      {
        id: 'anthropic',
        name: 'Anthropic',
        email: 'ana.silva@example.com',
        plan: 'Max',
        place: 0,
        about: 'Claude models, with a Pro or Max plan or an API key.',
        link: { label: 'Get a key', url: 'https://console.anthropic.com' },
        status: { type: 'oauth', hint: null },
        methods: [{ type: 'oauth', label: 'Sign in with Claude' }, key],
        addAccount: true,
        extra: false,
        tool: false,
      },
      {
        id: 'anthropic:2',
        name: 'Anthropic',
        email: worst
          ? 'ana.margarida.silva.contractor@northwind-industries-consulting.example'
          : 'ana@northwind.example',
        plan: 'Enterprise',
        place: 1,
        about: 'Claude models, with a Pro or Max plan or an API key.',
        link: null,
        status: { type: 'oauth', hint: null },
        methods: [{ type: 'oauth', label: 'Sign in with Claude' }],
        addAccount: false,
        extra: true,
        tool: false,
      },
      {
        id: 'openai-codex',
        name: 'ChatGPT',
        email: 'ana.silva@example.com',
        plan: 'Plus',
        place: null,
        about: 'Codex models with a ChatGPT plan.',
        link: null,
        status: { type: 'oauth', hint: null },
        methods: [{ type: 'oauth', label: 'Sign in with ChatGPT' }],
        addAccount: true,
        extra: false,
        tool: false,
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        email: null,
        plan: null,
        place: null,
        about: 'Hundreds of models behind one key.',
        link: { label: 'Get a key', url: 'https://openrouter.ai/keys' },
        status: { type: 'api_key', hint: 'f3a9' },
        methods: [key],
        addAccount: false,
        extra: false,
        tool: false,
      },
      {
        id: 'openai',
        name: 'OpenAI',
        email: null,
        plan: null,
        place: null,
        about: 'GPT models billed per token.',
        link: {
          label: 'Get a key',
          url: 'https://platform.openai.com/api-keys',
        },
        status: null,
        methods: [key],
        addAccount: false,
        extra: false,
        tool: false,
      },
      {
        id: 'exa',
        name: 'Exa',
        email: null,
        plan: null,
        place: null,
        about: worst
          ? 'Web search and fetch for the agent. Without it, the agent searches with a slower fallback that reads only the first page of results and often misses recent pages, which is why a key is worth setting up even on a free plan.'
          : 'Web search and fetch for the agent.',
        link: { label: 'Get a key', url: 'https://dashboard.exa.ai' },
        status: null,
        methods: [key],
        addAccount: false,
        extra: false,
        tool: true,
      },
    ],
    signIn: null,
  };
}

// Plan accounts with the limits of their last reply: two Claude accounts,
// the first one full, and ChatGPT.
export function fixturePlanUsage(worst: boolean): PlanUsage {
  return [
    {
      id: 'anthropic',
      family: 'anthropic',
      name: 'ana.silva@example.com',
      inUse: false,
      updatedAt: now - 3 * MIN,
      windows: [
        {
          key: 'five_hour',
          label: 'Session',
          utilization: worst ? 1 : 0.93,
          resetsAt: now + 2 * HOUR + 14 * MIN,
          limited: worst,
        },
        {
          key: 'seven_day',
          label: 'Week',
          utilization: 0.86,
          resetsAt: now + 3 * 24 * HOUR,
          limited: false,
        },
        {
          key: 'seven_day_opus',
          label: 'Opus',
          utilization: 0.31,
          resetsAt: now + 3 * 24 * HOUR,
          limited: false,
        },
        {
          key: 'extra',
          label: 'Extra',
          utilization: 0.62,
          resetsAt: null,
          limited: false,
        },
      ],
    },
    {
      id: 'anthropic:2',
      family: 'anthropic',
      name: worst
        ? 'ana.margarida.silva.contractor@northwind-industries-consulting.example'
        : 'ana@northwind.example',
      inUse: true,
      updatedAt: now - 2 * MIN,
      windows: [
        {
          key: '5h',
          label: 'Session',
          utilization: 0.08,
          resetsAt: now + 4 * HOUR,
          limited: false,
        },
        {
          key: '7d',
          label: 'Week',
          utilization: 0.21,
          resetsAt: now + 6 * 24 * HOUR,
          limited: false,
        },
      ],
    },
    {
      id: 'openai-codex',
      family: 'openai-codex',
      name: 'ChatGPT',
      inUse: false,
      updatedAt: now - MIN,
      windows: [
        {
          key: 'primary',
          label: 'Session',
          utilization: 0.12,
          resetsAt: now + 4 * HOUR,
          limited: false,
        },
        {
          key: 'secondary',
          label: 'Week',
          utilization: 0.4,
          resetsAt: now + 5 * 24 * HOUR,
          limited: false,
        },
      ],
    },
  ];
}

export function fixtureSettings(): Settings {
  return {
    model: { provider: 'anthropic', modelId: 'claude-opus-4-5' },
    thinkingLevel: 'medium',
    enabled: [],
    fastModel: { provider: 'anthropic', modelId: 'claude-haiku-4-5' },
    stageOnView: false,
    longCache: true,
    hubFolder: null,
    hubModel: null,
    nightStart: '01:00',
    fromEnv: { model: false, fastModel: false },
  };
}
