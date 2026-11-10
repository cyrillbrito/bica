import { createSignal, untrack } from 'solid-js';

import { request, useTopicWhenReady } from '../socket/socket';
import { toPromptImage } from '../sessions/images';
import { soundOn } from '../ui/sound';
import { errorText } from '../ui/errors';
import { stored } from '../ui/stored';

// Development only: `?voice=off` shows the app as it is without the sign-in
// calls and dictation need, kept for the tab like `?data=`. `?voice=on`
// goes back.
const VOICE_KEY = 'bica.voice';
if (import.meta.env.DEV) {
  const param = new URLSearchParams(location.search).get('voice');
  if (param === 'off') sessionStorage.setItem(VOICE_KEY, 'off');
  if (param === 'on') sessionStorage.removeItem(VOICE_KEY);
}
const voiceOff =
  import.meta.env.DEV && sessionStorage.getItem(VOICE_KEY) === 'off';

/**
 * Whether calls and dictation can work: they need the OpenAI Codex (legacy)
 * sign-in (docs/voice.md). True until the providers load, so their buttons
 * don't flash away for everyone who has it.
 */
export function useVoiceReady() {
  const catalog = useTopicWhenReady('models', () => ({}));
  return () =>
    !voiceOff &&
    (catalog()?.providers.some((p) => p.id === 'openai-codex') ?? true);
}

// Hold music: SomaFM's Groove Salad, https://somafm.com. An <audio> element
// like the voice, because iOS suspends Web Audio when the phone locks.
const MUSIC = 'https://ice.somafm.com/groovesalad-128-mp3';
// The stream is mastered loud, so even Loud is a few percent of full volume.
export const MUSIC_LEVELS = {
  off: 0,
  low: 0.005,
  medium: 0.01,
  high: 0.02,
  loud: 0.03,
};
export type MusicLevel = keyof typeof MUSIC_LEVELS;

// Per device, like the sounds: the speakers decide what is loud.
export const [musicLevel, setMusicLevel] = stored<MusicLevel>(
  'music',
  'medium',
  Object.keys(MUSIC_LEVELS) as MusicLevel[],
);

function musicVolume() {
  return MUSIC_LEVELS[untrack(musicLevel)] ?? MUSIC_LEVELS.medium;
}

const FADE_IN_MS = 1500;
const FADE_OUT_MS = 800;

const fades = new WeakMap<HTMLAudioElement, ReturnType<typeof setInterval>>();

/**
 * Steps the element's volume to `to` over the fade, starting from wherever
 * it is, so a new fade mid-way carries on without a jump. A timer rather
 * than Web Audio, which would stop the music when the phone locks.
 */
function fade(music: HTMLAudioElement, to: number, done?: () => void) {
  clearInterval(fades.get(music));
  const from = music.volume;
  const ms = to > from ? FADE_IN_MS : FADE_OUT_MS;
  const start = performance.now();
  const timer = setInterval(() => {
    const t = Math.min(1, (performance.now() - start) / ms);
    music.volume = from + (to - from) * t;
    if (t < 1) return;
    clearInterval(timer);
    fades.delete(music);
    done?.();
  }, 30);
  fades.set(music, timer);
}

// One voice call at a time, on one session. The browser owns the mic and the
// speaker (with echo cancellation); the server passes handoffs to the session.

type Who = 'you' | 'voice';

export type CallState = {
  sessionId: string;
  phase: 'connecting' | 'live' | 'error';
  muted: boolean;
  // Who is talking right now, if anyone.
  talking?: Who;
  // What is being said right now; once said, it is in the transcript.
  caption?: string;
  error?: string;
  // The mic gives pure silence, not even room noise: the browser or the
  // system isn't passing it through.
  micSilent?: boolean;
  // On photos being added: shown until they reach the agent, then for a
  // moment.
  photoNote?: { text: string; failed?: boolean };
};

// A real mic always picks up some noise; a dead track reads exactly zero.
const DEAD_RMS = 1e-5;
const DEAD_MS = 4000;

function trackState(track: MediaStreamTrack | undefined) {
  return (
    track && {
      label: track.label,
      readyState: track.readyState,
      muted: track.muted,
      enabled: track.enabled,
      settings: track.getSettings(),
    }
  );
}

type AudioStats = {
  // The voice reaching you.
  received: number;
  lost: number;
  // Audio the browser had to make up for late or lost packets, while the
  // voice was talking: what you hear as skipped or garbled words.
  concealedMs: number;
  jitterMs: number;
  // Your mic reaching OpenAI, as OpenAI reports it back.
  sent: number;
  sentLost: number;
  rttMs?: number;
};

const STATS_MS = 5000;

async function audioStats(pc: RTCPeerConnection): Promise<AudioStats> {
  const s: AudioStats = {
    received: 0,
    lost: 0,
    concealedMs: 0,
    jitterMs: 0,
    sent: 0,
    sentLost: 0,
  };
  const report = await pc.getStats();
  report.forEach((r) => {
    if (r.kind !== undefined && r.kind !== 'audio') return;
    if (r.type === 'inbound-rtp') {
      s.received = r.packetsReceived ?? 0;
      s.lost = r.packetsLost ?? 0;
      s.jitterMs = Math.round((r.jitter ?? 0) * 1000);
      const rate = r.clockRate || 48000;
      const audible =
        (r.concealedSamples ?? 0) - (r.silentConcealedSamples ?? 0);
      s.concealedMs = Math.round((audible / rate) * 1000);
    } else if (r.type === 'outbound-rtp') {
      s.sent = r.packetsSent ?? 0;
    } else if (r.type === 'remote-inbound-rtp') {
      s.sentLost = r.packetsLost ?? 0;
    } else if (
      r.type === 'candidate-pair' &&
      r.nominated &&
      r.state === 'succeeded'
    ) {
      if (r.currentRoundTripTime !== undefined)
        s.rttMs = Math.round(r.currentRoundTripTime * 1000);
    }
  });
  return s;
}

const [call, setCall] = createSignal<CallState | undefined>(undefined, {
  name: 'voiceCall',
});
export { call };

let current:
  | {
      end: () => void;
      mic?: MediaStream;
      music?: HTMLAudioElement;
      callId?: string;
      log: (event: string, data?: Record<string, unknown>) => void;
      level: (who: Who) => number;
    }
  | undefined;

function update(change: Partial<CallState>) {
  return setCall((c) => (c ? { ...c, ...change } : c));
}

/** How loud you or the voice are right now, 0 to 1. Read every frame. */
export function level(who: Who) {
  return current?.level(who) ?? 0;
}

/**
 * Fades the hold music in while the agent works in silence, and out again.
 * Muted once faded out, because iOS ignores an element's volume. The stream
 * keeps running either way, since restarting it takes seconds.
 */
export function holdMusic(on: boolean) {
  const music = current?.music;
  if (!music) return;
  if (!on || !musicVolume()) return fade(music, 0, () => (music.muted = true));
  if (music.muted) {
    music.volume = 0;
    music.muted = false;
  }
  fade(music, musicVolume());
}

/**
 * Starts a call. The session may still be being created: the mic and the
 * audio start in the click either way, which phones require.
 */
export async function startCall(session: string | Promise<string>) {
  current?.end();
  const trace = crypto.randomUUID().slice(0, 8);
  // Into the server's voice log, so a call that went wrong can be read later.
  const log = (event: string, data?: Record<string, unknown>) =>
    void request('voice.log', { trace, event, data }).catch(() => {});
  log('start', {
    userAgent: navigator.userAgent,
    standalone: matchMedia('(display-mode: standalone)').matches,
    visibility: document.visibilityState,
  });
  setCall({
    sessionId: typeof session === 'string' ? session : '',
    phase: 'connecting',
    muted: false,
  });
  const pc = new RTCPeerConnection();
  const audio = new Audio();
  audio.autoplay = true;
  let music: HTMLAudioElement | undefined;
  if (soundOn() && musicVolume() > 0) {
    music = new Audio(MUSIC);
    music.muted = true;
    music.volume = 0;
    // Started in the tap, which iOS requires. If it fails, the call just
    // has no music.
    music.play().catch(() => {});
  }
  const meters = new AudioContext();
  meters.onstatechange = () => log('meter', { state: meters.state });
  const analysers: Partial<Record<Who, AnalyserNode>> = {};
  const meter = (who: Who, stream: MediaStream) => {
    const analyser = meters.createAnalyser();
    analyser.fftSize = 512;
    meters.createMediaStreamSource(stream).connect(analyser);
    analysers[who] = analyser;
  };
  const samples = new Float32Array(512);
  const rms = (who: Who) => {
    const analyser = analysers[who];
    if (!analyser) return 0;
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    return Math.sqrt(sum / samples.length);
  };
  let callId: string | undefined;
  let watch: ReturnType<typeof setInterval> | undefined;
  // Logged only when a window loses packets or makes up audio, so a clean
  // call adds one summary line, and a bad one shows when it went bad.
  let stats: AudioStats | undefined;
  let statsWatch: ReturnType<typeof setInterval> | undefined;
  const sampleStats = async () => {
    if (pc.connectionState !== 'connected') return;
    const now = await audioStats(pc).catch(() => undefined);
    if (!now) return;
    const was = stats;
    stats = now;
    if (!was) return;
    const span = {
      lost: now.lost - was.lost,
      received: now.received - was.received,
      concealedMs: now.concealedMs - was.concealedMs,
      sentLost: now.sentLost - was.sentLost,
      sent: now.sent - was.sent,
      jitterMs: now.jitterMs,
      rttMs: now.rttMs,
    };
    if (span.lost > 0 || span.sentLost > 0 || span.concealedMs >= 100)
      log('audio trouble', span);
  };
  const self: NonNullable<typeof current> = {
    end: () => end(),
    log,
    music,
    // Speech sits around 0.02–0.2 RMS; stretch that over the meter.
    level: (who) => Math.min(1, rms(who) * 6),
  };
  current = self;
  photosOut = 0;
  const end = (error?: string) => {
    if (current !== self) return;
    current = undefined;
    log('end', { error, track: trackState(self.mic?.getAudioTracks()[0]) });
    clearInterval(watch);
    clearInterval(statsWatch);
    // From the last sample, up to a few seconds old: the connection closes now.
    if (stats) log('audio', stats);
    pc.close();
    self.mic?.getTracks().forEach((t) => t.stop());
    audio.srcObject = null;
    if (music) {
      // Emptying the source stops the download, which pause alone doesn't.
      fade(music, 0, () => {
        music.pause();
        music.removeAttribute('src');
        music.load();
      });
    }
    void meters.close();
    if (callId) void request('voice.stop', { callId });
    setCall(error ? (c) => c && { ...c, phase: 'error', error } : undefined);
  };

  try {
    self.mic = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (current !== self) return self.mic.getTracks().forEach((t) => t.stop());
    const track = self.mic.getAudioTracks()[0]!;
    log('mic', { track: trackState(track), meter: meters.state });
    for (const type of ['mute', 'unmute', 'ended'])
      track.addEventListener(type, () =>
        log(`mic ${type}`, { track: trackState(track) }),
      );
    // Created in the tap, but the mic prompt may have taken it out of it.
    void meters.resume();
    meter('you', self.mic);
    pc.addTrack(track, self.mic);
    // Pure silence for a while means the mic isn't reaching the call. Only
    // trusted while the meter runs, since a suspended one reads zero too,
    // and only until the mic is first heard: iOS gates the pauses between
    // words to exact zeros, so later silence is a false alarm. After that,
    // only the system muting or ending the track counts.
    let silentSince = Date.now();
    let heard = false;
    watch = setInterval(() => {
      if (meters.state !== 'running' || call()?.muted) {
        silentSince = Date.now();
        return;
      }
      const silent = rms('you') < DEAD_RMS;
      if (!silent) {
        silentSince = Date.now();
        heard = true;
      }
      const dead = heard
        ? track.muted || track.readyState === 'ended'
        : silent && Date.now() - silentSince > DEAD_MS;
      if (dead === !!call()?.micSilent) return;
      log(dead ? 'mic silent' : 'mic heard', { track: trackState(track) });
      update({ micSilent: dead });
    }, 500);
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      audio.srcObject = stream;
      meter('voice', stream);
    };
    pc.oniceconnectionstatechange = () =>
      log('ice', { state: pc.iceConnectionState });
    pc.onconnectionstatechange = () => {
      log('connection', { state: pc.connectionState });
      if (pc.connectionState === 'connected') {
        update({ phase: 'live' });
        statsWatch ??= setInterval(() => void sampleStats(), STATS_MS);
      }
      if (pc.connectionState === 'failed') end('Connection lost');
    };

    // The same events the server gets; here for the captions.
    const events = pc.createDataChannel('oai-events');
    events.onopen = () => log('events open');
    events.onclose = () => log('events closed');
    // Transcripts arrive in pieces, or whole so far; either way, grow. Pieces
    // can trail the end of a turn, so a caption also clears after a pause.
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const hush = () => {
      clearTimeout(quiet);
      update({ talking: undefined, caption: undefined });
    };
    const say = (who: Who, piece: string) => {
      setCall((c) => {
        if (!c) return c;
        const so = c.talking === who ? (c.caption ?? '') : '';
        const caption = piece.startsWith(so) ? piece : so + piece;
        return { ...c, talking: who, caption };
      });
      clearTimeout(quiet);
      quiet = setTimeout(hush, 2500);
    };
    events.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'input_transcript.added') say('you', event.item.text);
      else if (event.type === 'output_transcript.added')
        say('voice', event.item.text);
      else if (event.type === 'turn.done') hush();
      else if (event.type === 'error') {
        console.error('[voice]', event);
        log('error', { event });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const sessionId = await session;
    if (current !== self) return;
    update({ sessionId });
    const answer = await request('voice.start', {
      id: sessionId,
      sdp: offer.sdp!,
      trace,
    });
    callId = self.callId = answer.callId;
    if (current !== self) return void request('voice.stop', { callId });
    await pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
  } catch (error) {
    log('failed', {
      name: error instanceof Error ? error.name : undefined,
      message: String(error),
    });
    end(errorText(error));
  }
}

/**
 * Adds photos to the call, such as one just taken. The voice can't see them,
 * so the server holds them for the next handoff, or sends them alone after a
 * few quiet seconds. The note stays until they reach the agent, so a photo
 * never looks handled while it still waits.
 */
export async function addPhotos(files: File[]) {
  const callId = current?.callId;
  if (!callId || !files.length) return;
  clearTimeout(noteTimer);
  photosOut += files.length;
  update({ photoNote: { text: sending() } });
  let note: CallState['photoNote'];
  try {
    const images = await Promise.all(files.map(toPromptImage));
    await request('voice.photos', { callId, images });
    note = {
      text: `${files.length === 1 ? 'Photo' : 'Photos'} sent to the agent`,
    };
  } catch (error) {
    current?.log('photos failed', {
      count: files.length,
      error: String(error),
    });
    note = {
      text: errorText(error),
      failed: true,
    };
  }
  // A call that ended has its photos sent by the server.
  if (current?.callId !== callId) return;
  photosOut -= files.length;
  // Another add still waits: its note stays.
  if (photosOut && !note.failed) note = { text: sending() };
  update({ photoNote: note });
  if (!photosOut)
    noteTimer = setTimeout(() => update({ photoNote: undefined }), 4000);
}
let noteTimer: ReturnType<typeof setTimeout> | undefined;
// Photos added to this call that haven't reached the agent yet.
let photosOut = 0;
function sending() {
  return `Sending ${photosOut === 1 ? 'the photo' : `${photosOut} photos`} to the agent…`;
}

/** Hangs up, or dismisses a failed call. */
export function endCall() {
  if (current) current.end();
  else setCall(undefined);
}

export function toggleMute() {
  const muted = !call()?.muted;
  current?.mic?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  update({ muted });
}
