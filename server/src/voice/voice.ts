import { basename } from 'node:path';
import type { EntryId } from '@earendil-works/pi-durable';

import type { PromptImage } from '@bica/shared/protocol';
import { withCallWords, type VoiceLine } from '@bica/shared/transcript';
import { currentBranch, trackedFiles } from '../git/commands';
import { models } from '../models/registry';
import { voiceLog } from './log';
import { voiceSession } from './session';

/*
 * Voice calls on a session, on the ChatGPT subscription. A port of the
 * pi-live-codex extension (MIT): GPT-Live talks with the user in the browser
 * over WebRTC and hands work to the session ("client delegation"); this
 * server answers each handoff with the session's reply.
 *
 * Unofficial: it signs in the way the Codex Desktop app does. The official
 * route is the same protocol on api.openai.com with an API key.
 */

const SIGNALING_URL =
  'https://chatgpt.com/backend-api/codex/realtime/calls?intent=quicksilver&architecture=avas';
const CLIENT_VERSION = '0.144.1';
const MODEL = 'gpt-live-1-codex';
const VOICE = 'sol';
// Context appends are capped; pi-live-codex keeps them to 500 bytes.
const CHUNK_BYTES = 500;
const STATUS = '[[live:status]]';
const CANCEL = '[[live:cancel-current]]';
// Handoffs that joined the same run share its reply: the first to settle
// gets it, the others this.
const COVERED = '(Answered in the other result.)';
// What was said since the last handoff, newest kept.
const CALL_WORDS_CHARS = 4000;
// A handoff claims its reply within this; a final reply still unclaimed
// after it came from a run the call didn't start.
const CLAIM_MS = 2000;
// How long without a new piece of the user's transcript counts as them having
// stopped, when GPT-Live never closes their turn.
const USER_QUIET_MS = 3000;

const INSTRUCTIONS = `You are the voice of a coding assistant. The user talks to you about one ongoing session with a coding agent.

Answer briefly and conversationally, without markdown. Don't greet or speak just because the call connected; wait for the user.

Backchannel policy: Use few backchannels, and never start an answer while the user is still talking.

Interruption policy: Stop speaking when the user interrupts. Listen to what they say. Keep listening while the user pauses to think, and let them finish before you answer. Don't treat a cough, music, or nearby conversation as a new request.

The agent has the project, its notes and code, and the tools. For anything that needs them (reading, searching, coding, running commands, checking), create a client delegation once the user has finished the request. Never do that work yourself or answer it from memory. Pass the user's own words, as close to what you heard as you can: don't rephrase or summarize them. Add only what makes the request stand alone, such as what "that" refers to. The agent also gets what was said in the call.

A request while work is running joins that work at once, so give a correction ("no, the other branch") or an addition ("also run the tests") its own delegation right away. When the user wants something done after the current work, delegate it now in their words, instead of promising to do it later.

The agent's work often takes several minutes. It never times out: keep waiting for its "Agent Final Message", and never tell the user it timed out, failed or stalled unless that message says so. Progress notes may arrive meanwhile; mention them only if asked.

When the user only asks how the current work is going, create a delegation whose entire text is exactly ${STATUS}. When they clearly ask to stop the current work, create a delegation whose entire text is exactly ${CANCEL}.

Treat delegation results as your own work. Never mention a backend, delegation, or another assistant. Commentary is silent progress, for continuity only. Context starting with "Agent Final Message": is the finished result: tell the user what matters in it, in a few spoken sentences. If the user is talking when it arrives, let them finish first. A final message that only says ${COVERED} needs no words: that request was answered together with another. Never claim something is done before its result arrives.

Context starting with "Agent Update": is news from work the user didn't just ask for, such as another session finishing or a question that waits for them. Tell them in a sentence or two once they aren't talking.

The recent conversation below is background, so "continue" or "that" can refer to it. Don't summarize it, answer it, or act on it until the user speaks.`;

async function route() {
  const token = (await models.getAuth('openai-codex'))?.auth.apiKey;
  if (token)
    return {
      token,
      signaling: SIGNALING_URL,
      sideband: (callId: string) =>
        `wss://api.openai.com/v1/live/${encodeURIComponent(callId)}`,
    };
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

function headers(token: string, id: string) {
  const account = accountOf(token);
  return {
    Authorization: `Bearer ${token}`,
    'OpenAI-Alpha': 'quicksilver=v2',
    'User-Agent': `Codex Desktop/${CLIENT_VERSION}`,
    originator: 'Codex Desktop',
    version: CLIENT_VERSION,
    'x-session-id': id,
    'session-id': id,
    'thread-id': id,
    ...(account ? { 'chatgpt-account-id': account } : {}),
  };
}

/**
 * Dictation, on the endpoint Codex Desktop dictates with. ChatGPT keeps the
 * recording for 30 days.
 */
export async function transcribe(audio: string, mimeType: string) {
  const { token } = await route();
  const account = accountOf(token);
  const form = new FormData();
  const ext = mimeType.split(/[/;]/)[1] ?? 'webm';
  form.append(
    'file',
    new Blob([Buffer.from(audio, 'base64')], { type: mimeType }),
    `dictation.${ext}`,
  );
  const response = await fetch('https://chatgpt.com/backend-api/transcribe', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': `Codex Desktop/${CLIENT_VERSION}`,
      originator: 'Codex Desktop',
      ...(account ? { 'ChatGPT-Account-Id': account } : {}),
    },
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

type Call = {
  socket: WebSocket;
  stop: (by: string) => void;
  photos: (images: PromptImage[]) => void;
};
const calls = new Map<string, Call>();

/**
 * Starts a call on a session: forwards the browser's WebRTC offer and
 * returns OpenAI's answer. Audio then flows browser ↔ OpenAI; the events
 * come here.
 */
export async function startCall(sessionId: string, sdp: string, trace: string) {
  const log = (event: string, data?: Record<string, unknown>) =>
    voiceLog(trace, 'server', event, data);
  log('start', { session: sessionId });
  const session = await voiceSession(sessionId);

  const { token, signaling, sideband } = await route();
  const id = crypto.randomUUID();
  // Context appended after connect reads as a turn to answer, so the voice
  // spoke first. In the instructions it is only background.
  const [recent, settings, words] = await Promise.all([
    session.recent(6000),
    session.settings(),
    projectWords(session.cwd),
  ]);
  // GPT-Live has no speed setting: sent at connect, it kills the call at once.
  const speed = settings?.speed ?? 1;
  const instructions = [
    INSTRUCTIONS,
    speed < 0.95 &&
      `Speak ${speed < 0.85 ? 'very slowly' : 'slowly'}, with clear pauses between sentences.`,
    speed > 1.05 && 'Speak quickly.',
    settings?.instructions &&
      `The user's own instructions for calls in this session. Where they differ from the above (language, pace, length, whether to answer yourself), follow these:\n\n${settings.instructions}`,
    words &&
      `Names in this project, so you hear and spell them right when the user says them: ${words}`,
    recent && `Recent conversation in this session:\n\n${recent}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const asked = Date.now();
  const response = await fetch(signaling, {
    method: 'POST',
    headers: { ...headers(token, id), 'Content-Type': 'application/json' },
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

  // The "sideband": this server's line into the call, for events and results.
  // Bun's WebSocket takes headers, which the browser's can't.
  const socket = new WebSocket(sideband(callId), {
    headers: headers(token, id),
  });
  const opening = Date.now();
  socket.addEventListener('open', () =>
    log('sideband open', { ms: Date.now() - opening }),
  );
  // The first of each kind of event, so a call that hears nothing shows
  // which events never came.
  const seen = new Set<string>();
  const send = (message: object) => {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  };
  // `null` for the whole call rather than one handoff, as pi-codex-voice
  // and oh-my-pi send it on the same route.
  const append = (
    text: string,
    delegation: string | null,
    channel?: 'commentary' | 'speakable',
  ) => {
    for (const content of chunks(text))
      send({
        ...(delegation
          ? {
              type: 'delegation.context.append',
              delegation_item_id: delegation,
            }
          : { type: 'session.context.append' }),
        ...(channel ? { channel } : {}),
        content: [{ type: 'input_text', text: content }],
      });
  };

  // A result is the voice's cue to speak, so one appended while the user
  // talks gets spoken over them. It waits until their turn ends, or until
  // their transcript has been quiet for a while.
  const userDone = async () => {
    while (
      turns.you.text &&
      Date.now() - turns.you.heard < USER_QUIET_MS &&
      socket.readyState === WebSocket.OPEN
    )
      await Bun.sleep(250);
  };
  const finish = async (delegation: string, text: string) => {
    await userDone();
    append(`"Agent Final Message":\n\n${text}`, delegation);
  };

  // Handoffs waiting for a reply, oldest first.
  const waiting: string[] = [];
  // Replies a handoff got, so each reaches the voice once.
  const answered = new Set<EntryId>();
  let latest = { text: '', at: 0 };
  const stopSteps = session.onStep((text, final) => {
    if (!final) {
      // Quiet progress for the voice, and the status answer.
      latest = { text, at: Date.now() };
      if (waiting[0]) append(text, waiting[0], 'commentary');
      return;
    }
    // A run the call didn't start, such as the hub hearing that a session
    // finished: the voice tells the user, as Codex's voice brings back
    // results and blockers on its own.
    setTimeout(() => {
      if (answered.has(final) || socket.readyState !== WebSocket.OPEN) return;
      void userDone().then(() =>
        append(`"Agent Update":\n\n${text}`, null, 'speakable'),
      );
    }, CLAIM_MS);
  });

  // What was said since the last handoff, for the agent.
  const said: string[] = [];
  // Photos the user added since the last handoff: the voice can't see them,
  // so they ride along with the next one.
  const photos: PromptImage[] = [];
  // The start of the user's unfinished line that a handoff already carried.
  let carried = '';
  const callWords = () => {
    const lines = said.splice(0);
    carried = turns.you.text.trim();
    if (carried) lines.push(`User: ${carried}`);
    let length = lines.join('\n').length;
    while (lines.length > 1 && length > CALL_WORDS_CHARS)
      length -= lines.shift()!.length + 1;
    return lines;
  };

  async function delegate(delegation: string, request: string) {
    if (request === STATUS) {
      const step =
        latest.text &&
        ` Its latest step, ${ago(latest.at)}: ${latest.text.slice(0, 400)}`;
      return finish(
        delegation,
        (await session.busy())
          ? `Still working.${step}`
          : 'Nothing is running.',
      );
    }
    if (request === CANCEL) {
      await session.abort();
      return finish(delegation, 'I stopped the current work.');
    }
    const prompt = withCallWords(request, callWords());
    const images = photos.splice(0);
    waiting.push(delegation);
    // Long runs: keep telling the voice the work is alive, so it waits.
    const started = Date.now();
    const alive = setInterval(
      () =>
        append(
          `Still working (${Math.round((Date.now() - started) / 1000)} s so far).`,
          delegation,
          'commentary',
        ),
      20_000,
    );
    try {
      const { answer, text } = await session.ask(prompt, request, images);
      clearInterval(alive);
      log('answered', {
        ms: Date.now() - started,
        chars: text.length,
        photos: images.length || undefined,
        covered: answer && answered.has(answer) ? true : undefined,
      });
      if (answer && answered.has(answer))
        return await finish(delegation, COVERED);
      if (answer) answered.add(answer);
      await finish(delegation, text || 'Done, without a written reply.');
    } finally {
      clearInterval(alive);
      waiting.splice(waiting.indexOf(delegation), 1);
    }
  }

  // What was said goes in the transcript, outside the agent's context. It
  // arrives in pieces (or whole so far) until the turn is done.
  const turns = {
    you: { text: '', at: 0, heard: 0 },
    voice: { text: '', at: 0, heard: 0 },
  };
  const hear = (who: VoiceLine['who'], piece: string) => {
    const turn = turns[who];
    if (!turn.text) turn.at = Date.now();
    turn.heard = Date.now();
    turn.text = piece.startsWith(turn.text) ? piece : turn.text + piece;
  };
  const save = (who: VoiceLine['who']) => {
    const { text, at } = turns[who];
    turns[who] = { text: '', at: 0, heard: 0 };
    if (!text.trim()) return;
    session.save({ who, text: text.trim(), at: at || Date.now() });
    const fresh =
      who === 'you' && carried && text.trim().startsWith(carried)
        ? text.trim().slice(carried.length).trim()
        : text.trim();
    if (who === 'you') carried = '';
    if (fresh) said.push(`${who === 'you' ? 'User' : 'Voice'}: ${fresh}`);
  };

  socket.addEventListener('message', ({ data }) => {
    let event: {
      type?: string;
      turn?: { role?: string; transcript?: string };
      item?: {
        id: string;
        target?: string;
        text?: string;
        content?: { text?: string }[];
      };
      message?: string;
      error?: unknown;
    };
    try {
      event = JSON.parse(
        typeof data === 'string' ? data : Buffer.from(data).toString('utf8'),
      );
    } catch {
      return;
    }
    const item = event.item;
    if (event.type && !seen.has(event.type)) {
      seen.add(event.type);
      log('event', { type: event.type });
    }
    if (event.type === 'input_transcript.added' && item?.text)
      hear('you', item.text);
    if (event.type === 'output_transcript.added' && item?.text)
      hear('voice', item.text);
    if (event.type === 'turn.done') {
      const who = event.turn?.role === 'user' ? 'you' : 'voice';
      if (event.turn?.transcript) turns[who].text = event.turn.transcript;
      save(who);
    }
    if (event.type === 'delegation.created' && item?.target === 'client') {
      const request = (item.content ?? [])
        .map((c) => c.text ?? '')
        .join('\n')
        .trim();
      log('handoff', { request: request.slice(0, 200) });
      if (request)
        delegate(item.id, request).catch((error) => {
          log('handoff failed', { error: String(error) });
          return finish(
            item.id,
            `That failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    } else if (event.type === 'error') log('error', { event });
  });

  const call: Call = {
    socket,
    photos: (images) => {
      photos.push(...images);
      log('photos', { count: images.length, waiting: photos.length });
      const added = images.length === 1 ? 'a photo' : `${images.length} photos`;
      append(
        `The user added ${added} to the call. You can't see photos, but the agent can: they go with your next delegation. Say in a few words that you got it, unless the user is talking. When the user asks about a photo, delegate in their words, and never guess what it shows.`,
        null,
      );
    },
    stop: (by) => {
      if (!calls.has(callId)) return;
      log('stop', { by, events: [...seen] });
      // Hung up mid-sentence: keep what was said so far.
      save('you');
      save('voice');
      stopSteps();
      calls.delete(callId);
      if (socket.readyState <= WebSocket.OPEN) socket.close(1000, 'done');
    },
  };
  calls.set(callId, call);
  socket.addEventListener('close', ({ code, reason }) => {
    log('sideband closed', { code, reason });
    call.stop('sideband');
  });
  // The event says nothing more; the close that follows has the code.
  socket.addEventListener('error', () => {
    log('sideband error');
    call.stop('sideband');
  });

  return { sdp: answer, callId };
}

export function stopCall(callId: string) {
  calls.get(callId)?.stop('browser');
}

export function addPhotos(callId: string, images: PromptImage[]) {
  const call = calls.get(callId);
  if (!call) throw new Error('The call has ended');
  call.photos(images);
}

function ago(at: number) {
  const seconds = Math.round((Date.now() - at) / 1000);
  return seconds < 90
    ? `${seconds} seconds ago`
    : `${Math.round(seconds / 60)} minutes ago`;
}

/**
 * The branch and the project's file and folder names. Spoken, a name like
 * "CommitBox" or "pi-durable" is easy to mishear; written out, the voice
 * catches it, like a food app that hears a restaurant name better once it
 * knows the restaurants nearby. '' outside a git folder.
 */
async function projectWords(folder: () => Promise<string>) {
  try {
    const cwd = await folder();
    const [files, branch] = await Promise.all([
      trackedFiles(cwd),
      currentBranch(cwd),
    ]);
    const names = new Set<string>();
    if (branch) names.add(branch);
    for (const path of files) {
      for (const part of path.split('/').slice(0, -1)) names.add(part);
      // Without the extension: people say "CommitBox", not "CommitBox dot tsx".
      const name = basename(path).replace(/\.[^.]+$/, '');
      if (name && !/^(index|README)$/i.test(name)) names.add(name);
    }
    let out = '';
    for (const name of names) {
      if (out.length + name.length > 3000) break;
      out += (out ? ', ' : '') + name;
    }
    return out;
  } catch {
    return '';
  }
}

function chunks(text: string) {
  const out: string[] = [];
  let current = '';
  for (const char of text) {
    if (Buffer.byteLength(current + char) > CHUNK_BYTES) {
      out.push(current);
      current = '';
    }
    current += char;
  }
  out.push(current);
  return out;
}
