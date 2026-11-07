import { isExpiredSignIn } from '@bica/shared/model-errors';

/**
 * Provider errors arrive as one string, often a status and a raw JSON body:
 * `402 {"error":{"message":"…"}}`. This pulls out the line worth reading and
 * keeps the body, pretty printed, for the details.
 */
export function readError(raw: string): {
  status?: string;
  message: string;
  details?: string;
  signIn?: boolean;
} {
  const text = raw.trim();
  if (isExpiredSignIn(text)) {
    const readable = /sign-in expired or was revoked/i.test(text);
    return {
      signIn: true,
      message: readable
        ? text
        : 'The provider sign-in expired or was revoked. Sign in again in Settings → Providers, then resend your prompt.',
      details: readable ? undefined : text,
    };
  }
  const start = text.search(/[{[]/);
  const body = start < 0 ? undefined : parse(text.slice(start));
  const prefix = (start < 0 ? text : text.slice(0, start)).trim();
  const status = /^\d{3}\b/.exec(prefix)?.[0];
  if (body === undefined)
    return { status, message: status ? text.slice(3).trim() || text : text };
  const found = messageOf(body);
  const rest = prefix
    .slice(status?.length ?? 0)
    .replace(/[:\s]+$/, '')
    .trim();
  return {
    status,
    message: found ?? (rest || 'Request failed'),
    details: JSON.stringify(body, null, 2),
  };
}

function parse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** The first `message` string, looking under `error` before anything else. */
function messageOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.error === 'string') return v.error;
  return (
    messageOf(v.error) ??
    (typeof v.message === 'string' ? v.message : undefined) ??
    (typeof v.detail === 'string' ? v.detail : undefined)
  );
}
