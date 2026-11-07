// pi-ai provider ids and their icon in LobeHub's set. Plans and regions
// (openai-codex, minimax-cn) are matched by their first words.
const ICONS: Record<string, string> = {
  'amazon-bedrock': 'bedrock',
  'ant-ling': 'ling',
  anthropic: 'anthropic',
  azure: 'azure',
  baseten: 'baseten',
  cerebras: 'cerebras',
  cloudflare: 'cloudflare',
  'cloudflare-workers-ai': 'workersai',
  deepseek: 'deepseek',
  exa: 'exa',
  fireworks: 'fireworks',
  'github-copilot': 'githubcopilot',
  google: 'google',
  'google-vertex': 'vertexai',
  groq: 'groq',
  huggingface: 'huggingface',
  kimi: 'kimi',
  meta: 'meta',
  minimax: 'minimax',
  mistral: 'mistral',
  moonshotai: 'moonshot',
  nvidia: 'nvidia',
  openai: 'openai',
  opencode: 'opencode',
  openrouter: 'openrouter',
  qwen: 'qwen',
  together: 'together',
  vercel: 'vercel',
  xai: 'xai',
  xiaomi: 'xiaomimimo',
  zai: 'zai',
};

/** The provider's logo, single color, or undefined when LobeHub has none. */
export function providerLogo(provider: string) {
  // Extra accounts (anthropic:2) wear their provider's logo.
  let id = provider.split(':')[0]!;
  while (!ICONS[id] && id.includes('-')) id = id.slice(0, id.lastIndexOf('-'));
  const icon = ICONS[id];
  return (
    icon &&
    `https://unpkg.com/@lobehub/icons-static-svg@1.98.0/icons/${icon}.svg`
  );
}
