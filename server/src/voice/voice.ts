import type { EntryId } from '@earendil-works/pi-durable';

import type { PromptImage } from '@bica/shared/protocol';
import { withCallWords } from '@bica/shared/transcript';
import { heard } from './heard';
import { voiceLog } from './log';
import { APPEND_BYTES, chunks, connect, type LiveEvent } from './openai';
import * as prompt from './prompt';
import { voiceSession } from './session';

export { transcribe } from './openai';

/*
 * Voice calls on a session (docs/voice.md). GPT-Live talks with the user in
 * the browser over WebRTC and hands work to the session ("client
 * delegation"); this server answers each handoff with how the session's run
 * ended. The wire is openai.ts, the words prompt.ts, the session session.ts.
 */

// Photos no handoff took go on their own: after this long without the user
// talking, or when the call ends. A photo followed by "log this" still goes
// with those words, and one sent in silence isn't left waiting.
const PHOTOS_ALONE_MS = 5000;
// A handoff claims its run's end within this; an end still unclaimed after
// it came from a run the call didn't start.
const CLAIM_MS = 2000;
// Long runs: how often the voice hears the work is alive, so it waits.
const ALIVE_MS = 20_000;

type Call = {
  stop: (by: string) => void;
  // Resolves once the photos go to the agent.
  photos: (images: PromptImage[]) => Promise<void>;
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
  const [recent, settings, brief] = await Promise.all([
    session.recent(6000),
    session.settings(),
    session.brief(),
  ]);
  const rules = prompt.rules(brief, settings);
  // The ChatGPT route ignores the instructions sent at setup and refuses to
  // change them later, so the rules go again as silent commentary once the
  // call starts (openclaw#199052). Setup keeps them, as Codex sends them
  // there, along with the recent conversation.
  const line = await connect(
    sdp,
    [rules, recent && prompt.recentContext(recent)]
      .filter(Boolean)
      .join('\n\n'),
    log,
  );
  const { callId, append, open } = line;

  const said = heard((l) => session.save(l));
  const quiet = () => said.quiet(open);
  // A result is the voice's cue to speak, so it waits for the user to finish.
  const result = async (delegation: string, text: string) => {
    await quiet();
    append(text, delegation);
  };

  // Handoffs waiting for their run to end, oldest first, and the replies
  // given, so each reaches the voice once.
  const waiting: string[] = [];
  const answered = new Set<EntryId>();
  let latest = { text: '', at: 0 };
  const stopProgress = session.onProgress((text) => {
    latest = { text, at: Date.now() };
    if (waiting[0]) append(text, waiting[0], 'commentary');
  });
  // A run the call didn't start, such as a bot hearing that a session
  // finished: the voice tells the user, as Codex's voice brings back results
  // and blockers on its own.
  const stopRuns = session.onRunEnd((ending) =>
    setTimeout(async () => {
      if (!open() || (ending.answer && answered.has(ending.answer))) return;
      await quiet();
      append(prompt.update(ending.text, ending.waits), null, 'speakable');
    }, CLAIM_MS),
  );

  // Photos the user added since the last handoff: the voice can't see them,
  // so they ride along with the next one, or go alone.
  const photos: PromptImage[] = [];
  const photosSent: (() => void)[] = [];
  let photosTimer: ReturnType<typeof setTimeout> | undefined;
  const takePhotos = () => {
    clearTimeout(photosTimer);
    for (const sent of photosSent.splice(0)) sent();
    return photos.splice(0);
  };
  const sendPhotos = (why: string) => {
    const images = takePhotos();
    if (!images.length) return;
    log('photos alone', { count: images.length });
    // The reply comes back as a run the call didn't start.
    session
      .ask(withCallWords(why, said.take()), 'Photos from a call', images)
      .catch((error: unknown) =>
        log('photos alone failed', { error: String(error) }),
      );
  };
  const photosLater = () => {
    clearTimeout(photosTimer);
    photosTimer = setTimeout(() => {
      if (!open()) return;
      // Talking: the voice may be about to hand them off with the words.
      if (said.talking()) return photosLater();
      sendPhotos(prompt.PHOTOS_ALONE);
    }, PHOTOS_ALONE_MS);
  };

  async function delegate(delegation: string, request: string) {
    if (request === prompt.STATUS) {
      const busy = await session.busy();
      const step =
        latest.text && `${ago(latest.at)}: ${latest.text.slice(0, 400)}`;
      return result(
        delegation,
        prompt.finalMessage(prompt.status(busy, step), []),
      );
    }
    if (request === prompt.CANCEL) {
      await session.abort();
      return result(
        delegation,
        prompt.finalMessage('I stopped the current work.', []),
      );
    }
    const images = takePhotos();
    waiting.push(delegation);
    const started = Date.now();
    const alive = setInterval(
      () =>
        append(
          prompt.stillWorking(Math.round((Date.now() - started) / 1000)),
          delegation,
          'commentary',
        ),
      ALIVE_MS,
    );
    try {
      const ending = await session.ask(
        withCallWords(request, said.take(request)),
        request,
        images,
      );
      const covered = !!ending.answer && answered.has(ending.answer);
      log('answered', {
        ms: Date.now() - started,
        chars: ending.text.length,
        waits: ending.waits.length || undefined,
        photos: images.length || undefined,
        covered: covered || undefined,
      });
      if (ending.answer) answered.add(ending.answer);
      await result(
        delegation,
        covered
          ? prompt.finalMessage(prompt.COVERED, [])
          : prompt.finalMessage(ending.text, ending.waits),
      );
    } finally {
      clearInterval(alive);
      waiting.splice(waiting.indexOf(delegation), 1);
    }
  }

  const seen = new Set<string>();
  const handle = (event: LiveEvent) => {
    const { type, item } = event;
    if (!type) return;
    if (!seen.has(type)) {
      seen.add(type);
      log('event', { type });
      if (type === 'session.started') {
        const parts = chunks(rules, APPEND_BYTES - 120);
        parts.forEach((part, i) =>
          append(prompt.setupPart(part, i, parts.length), null, 'commentary'),
        );
        log('rules sent', { chars: rules.length, parts: parts.length });
      }
    }
    switch (type) {
      case 'input_transcript.added':
        if (item?.text) said.piece('you', item.text);
        return;
      case 'output_transcript.added':
        if (item?.text) said.piece('voice', item.text);
        return;
      case 'turn.done':
        said.done(
          event.turn?.role === 'user' ? 'you' : 'voice',
          event.turn?.transcript,
        );
        return;
      case 'delegation.created': {
        if (item?.target !== 'client') return;
        const request = (item.content ?? [])
          .map((c) => c.text ?? '')
          .join('\n')
          .trim();
        log('handoff', { request: request.slice(0, 200) });
        if (!request) return;
        delegate(item.id, request).catch((error: unknown) => {
          log('handoff failed', { error: String(error) });
          return result(
            item.id,
            prompt.finalMessage(
              `That failed: ${error instanceof Error ? error.message : String(error)}`,
              [],
            ),
          );
        });
        return;
      }
      case 'error':
        log('error', { event });
    }
  };
  line.socket.addEventListener('message', ({ data }) => {
    let event: LiveEvent;
    try {
      event = JSON.parse(
        typeof data === 'string' ? data : Buffer.from(data).toString('utf8'),
      );
    } catch {
      return;
    }
    handle(event);
  });

  const call: Call = {
    photos: (images) => {
      photos.push(...images);
      log('photos', { count: images.length, waiting: photos.length });
      append(prompt.photosAdded(images.length), null);
      photosLater();
      return new Promise<void>((resolve) => photosSent.push(resolve));
    },
    stop: (by) => {
      if (!calls.has(callId)) return;
      log('stop', { by, events: [...seen] });
      // Hung up mid-sentence: keep what was said so far.
      said.done('you');
      said.done('voice');
      stopProgress();
      stopRuns();
      calls.delete(callId);
      if (line.socket.readyState <= WebSocket.OPEN)
        line.socket.close(1000, 'done');
      // Photos no handoff took still reach the agent, with what was said
      // about them, instead of being lost with the call.
      sendPhotos(prompt.PHOTOS_AFTER_CALL);
    },
  };
  calls.set(callId, call);
  line.socket.addEventListener('close', ({ code, reason }) => {
    log('sideband closed', { code, reason });
    call.stop('sideband');
  });
  // The event says nothing more; the close that follows has the code.
  line.socket.addEventListener('error', () => {
    log('sideband error');
    call.stop('sideband');
  });

  return { sdp: line.sdp, callId };
}

export function stopCall(callId: string) {
  calls.get(callId)?.stop('browser');
}

/** Adds photos to a call; resolves once they go to the agent. */
export function addPhotos(callId: string, images: PromptImage[]) {
  const call = calls.get(callId);
  if (!call) throw new Error('The call has ended');
  return call.photos(images);
}

function ago(at: number) {
  const seconds = Math.round((Date.now() - at) / 1000);
  return seconds < 90
    ? `${seconds} seconds ago`
    : `${Math.round(seconds / 60)} minutes ago`;
}
