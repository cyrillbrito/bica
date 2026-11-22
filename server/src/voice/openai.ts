import { models } from '../models/registry';

/*
 * GPT-Live on the ChatGPT subscription, a port of the pi-live-codex
 * extension (MIT). Unofficial: it signs in the way the Codex Desktop app
 * does. The official route is the same protocol on api.openai.com with an
 * API key. This file is only the wire; voice.ts is the call.
 */

const SIGNALING_URL =
  'https://chatgpt.com/backend-api/codex/realtime/calls?intent=quicksilver&architecture=avas';
const CLIENT_VERSION = '0.144.1';
const MODEL = 'gpt-live-1-codex';
const VOICE = 'sol';
// Context appends are capped; pi-live-codex keeps them to 500 bytes.
const CHUNK_BYTES = 500;

/** The events from the sideband that the call reads. */
export type LiveEvent = {
  type?: string;
  turn?: { role?: string; transcript?: string };
  item?: {
    id: string;
    target?: string;
    text?: string;
    content?: { text?: string }[];
  };
};

async function token() {
  const token = (await models.getAuth('openai-codex'))?.auth.apiKey;
  if (token) return token;
  throw new Error(
    'Voice and dictation need the OpenAI Codex (legacy) sign-in: Settings → Providers',
  );
}

// The ChatGPT account comes from the sign-in's JWT.
function accountOf(token: string) {
  try {
    const claims = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(),
    );
    return claims['https://api.openai.com/auth']?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

function headers(token: string, id?: string) {
  const account = accountOf(token);
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': `Codex Desktop/${CLIENT_VERSION}`,
    originator: 'Codex Desktop',
    ...(account ? { 'chatgpt-account-id': account } : {}),
    ...(id && {
      'OpenAI-Alpha': 'quicksilver=v2',
      version: CLIENT_VERSION,
      'x-session-id': id,
      'session-id': id,
      'thread-id': id,
    }),
  };
}

/**
 * Dictation, on the endpoint Codex Desktop dictates with. ChatGPT keeps the
 * recording for 30 days.
 */
export async function transcribe(audio: string, mimeType: string) {
  const form = new FormData();
  const ext = mimeType.split(/[/;]/)[1] ?? 'webm';
  form.append(
    'file',
    new Blob([Buffer.from(audio, 'base64')], { type: mimeType }),
    `dictation.${ext}`,
  );
  const response = await fetch('https://chatgpt.com/backend-api/transcribe', {
    method: 'POST',
    headers: headers(await token()),
    body: form,
  });
  if (!response.ok)
    throw new Error(
      `Dictation failed: ${response.status} ${await response.text()}`.slice(
        0,
        300,
      ),
    );
  const { text } = (await response.json()) as { text?: string };
  return { text: text?.trim() ?? '' };
}

/**
 * Sets up a call: forwards the browser's WebRTC offer and returns OpenAI's
 * answer, and opens the sideband, this server's line into the call for
 * events and results. Bun's WebSocket takes headers, which the browser's
 * can't.
 */
export async function connect(
  sdp: string,
  instructions: string,
  log: (event: string, data?: Record<string, unknown>) => void,
) {
  const auth = await token();
  const id = crypto.randomUUID();
  const asked = Date.now();
  const response = await fetch(SIGNALING_URL, {
    method: 'POST',
    headers: { ...headers(auth, id), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sdp,
      session: {
        model: MODEL,
        instructions,
        audio: { output: { voice: VOICE } },
        delegation: { type: 'client' },
      },
    }),
  });
  const answer = await response.text();
  if (!response.ok) {
    log('refused', { status: response.status, body: answer.slice(0, 1000) });
    throw new Error(
      `Voice call refused (${response.status}): ${answer.slice(0, 300)}`,
    );
  }
  const callId = response.headers
    .get('location')
    ?.split('?')[0]
    ?.split('/')
    .find((part) => /^rtc_[\w-]+$/.test(part));
  log('signaled', {
    callId,
    ms: Date.now() - asked,
    instructions: instructions.length,
  });
  if (!callId) throw new Error('Voice call has no id');

  const socket = new WebSocket(
    `wss://api.openai.com/v1/live/${encodeURIComponent(callId)}`,
    { headers: headers(auth, id) },
  );
  const opening = Date.now();
  socket.addEventListener('open', () =>
    log('sideband open', { ms: Date.now() - opening }),
  );
  const open = () => socket.readyState === WebSocket.OPEN;

  return {
    sdp: answer,
    callId,
    socket,
    open,
    /**
     * Adds context to the call, for one handoff or, with `null`, the whole
     * call, as pi-live-codex sends it. `commentary` is read silently;
     * `speakable` and a result are spoken.
     */
    append(
      text: string,
      delegation: string | null,
      channel?: 'commentary' | 'speakable',
    ) {
      if (!open()) return;
      for (const content of chunks(text))
        socket.send(
          JSON.stringify({
            ...(delegation
              ? {
                  type: 'delegation.context.append',
                  delegation_item_id: delegation,
                }
              : { type: 'session.context.append' }),
            ...(channel && { channel }),
            content: [{ type: 'input_text', text: content }],
          }),
        );
    },
  };
}

/** Splits text into appends under the cap, at a space where it can. */
export function chunks(text: string, size = CHUNK_BYTES) {
  const out: string[] = [];
  let current = '';
  for (const char of text) {
    if (Buffer.byteLength(current + char) > size) {
      const space = current.lastIndexOf(' ');
      const cut = space > current.length / 2 ? space + 1 : current.length;
      out.push(current.slice(0, cut));
      current = current.slice(cut);
    }
    current += char;
  }
  out.push(current);
  return out;
}

export const APPEND_BYTES = CHUNK_BYTES;
