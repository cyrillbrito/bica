import type { Account, PlanWindow } from '@bica/shared/protocol';

/*
 * Everything Bica knows about particular providers, beyond what pi-ai tells:
 * a guide for Settings, who a plan sign-in belongs to, and the plan limits in
 * its replies. The rest of models/ works the same for every provider.
 */

// Listed first, with a guide; every other pi-ai provider follows by name.
export const GUIDES: Record<string, Pick<Account, 'about' | 'link'>> = {
  anthropic: {
    about:
      'Sign in with a Claude Pro or Max plan, or add an API key (billed per use).',
    link: {
      label: 'API keys',
      url: 'https://console.anthropic.com/settings/keys',
    },
  },
  'openai-codex': {
    about:
      'Sign in with a ChatGPT Plus or Pro plan: sessions get the Codex models, and voice calls and dictation use it.',
    link: null,
  },
  openai: {
    about:
      'Sign in with a ChatGPT Plus or Pro plan, or add an API key (billed per use). Voice calls and dictation need OpenAI Codex (legacy) instead.',
    link: { label: 'API keys', url: 'https://platform.openai.com/api-keys' },
  },
};

export interface Identity {
  email?: string;
  plan?: string;
}

// Plan names as the providers sell them.
const CLAUDE_PLANS: Record<string, string> = {
  claude_free: 'Free',
  claude_pro: 'Pro',
  claude_max: 'Max',
  claude_team: 'Team',
  claude_enterprise: 'Enterprise',
};
function title(s: string) {
  return s[0]!.toUpperCase() + s.slice(1);
}

/**
 * Who a plan sign-in belongs to: Claude's profile endpoint (the one Claude
 * Code reads), or the claims in a ChatGPT sign-in token.
 */
export async function lookUp(
  provider: string,
  token: string,
): Promise<Identity | null> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/api/oauth/profile', {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      account?: { email?: string };
      organization?: { organization_type?: string };
    };
    const type = body.organization?.organization_type;
    return {
      email: body.account?.email,
      plan: type && (CLAUDE_PLANS[type] ?? title(type.replace(/^claude_/, ''))),
    };
  }
  // Both ChatGPT sign-ins; a token without the claims tells nothing.
  if (provider === 'openai-codex' || provider === 'openai') {
    let claims: Record<string, { email?: string; chatgpt_plan_type?: string }>;
    try {
      claims = JSON.parse(
        Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(),
      );
    } catch {
      return null;
    }
    const plan = claims['https://api.openai.com/auth']?.chatgpt_plan_type;
    return {
      email: claims['https://api.openai.com/profile']?.email,
      plan: plan && title(plan),
    };
  }
  return null;
}

/** The plan limits in a reply's headers, keys lowercased; none on a key. */
export function limitWindows(headers: Record<string, string>): PlanWindow[] {
  return [...claudeWindows(headers), ...codexWindows(headers)];
}

function seconds(value: string | undefined) {
  return value && Number(value) ? Number(value) * 1000 : null;
}

function claudeWindows(s: Record<string, string>): PlanWindow[] {
  return (
    [
      ['5h', 'Session'],
      ['7d', 'Week'],
      ['overage', 'Extra'],
    ] as const
  ).flatMap(([key, label]) => {
    const used = s[`anthropic-ratelimit-unified-${key}-utilization`];
    if (used === undefined) return [];
    return [
      {
        key,
        label,
        utilization: Number(used),
        resetsAt: seconds(s[`anthropic-ratelimit-unified-${key}-reset`]),
        limited: s[`anthropic-ratelimit-unified-${key}-status`] === 'rejected',
      },
    ];
  });
}

function codexWindows(s: Record<string, string>): PlanWindow[] {
  return (['primary', 'secondary'] as const).flatMap((key) => {
    const used = s[`x-codex-${key}-used-percent`];
    if (used === undefined) return [];
    const minutes = Number(s[`x-codex-${key}-window-minutes`]);
    return [
      {
        key,
        label:
          minutes === 300
            ? 'Session'
            : minutes === 10_080
              ? 'Week'
              : `${Math.round(minutes / 60)}h`,
        utilization: Number(used) / 100,
        resetsAt: seconds(s[`x-codex-${key}-reset-at`]),
        limited: Number(used) >= 100,
      },
    ];
  });
}
