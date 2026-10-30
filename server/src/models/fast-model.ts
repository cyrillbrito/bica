import { models } from './registry';
import { settings } from '../settings';

/**
 * A small, cheap model for quick side jobs (session titles, commit
 * messages): one call, no tools, outside the harness. Picked in Settings
 * (`PI_FAST_MODEL` until then); unset: the features that need it quietly do
 * without.
 */
export function fastModelId() {
  const ref = settings().fastModel;
  return ref && `${ref.provider}/${ref.modelId}`;
}

const THINKING_ROOM = 2_000;

/** One system prompt and one user message in, the reply's text out. */
export async function askFast(
  systemPrompt: string,
  prompt: string,
  { maxTokens, timeoutMs = 20_000 }: { maxTokens: number; timeoutMs?: number },
) {
  const id = fastModelId();
  if (!id) throw new Error('No fast model set (Settings → Models)');
  const [provider, ...rest] = id.split('/');
  const model = models.getModel(provider!, rest.join('/'));
  if (!model) throw new Error(`Unknown model ${id}`);
  const reply = await models.completeSimple(
    model,
    {
      systemPrompt,
      messages: [{ role: 'user', content: prompt, timestamp: Date.now() }],
    },
    {
      // Some models think silently first, and a
      // tight cap leaves no room for the reply; callers keep only one line.
      maxTokens: maxTokens + THINKING_ROOM,
      signal: AbortSignal.timeout(timeoutMs),
    },
  );
  if (reply.stopReason === 'error') throw new Error(reply.errorMessage);
  return reply.content
    .flatMap((part) => (part.type === 'text' ? part.text : []))
    .join('');
}
