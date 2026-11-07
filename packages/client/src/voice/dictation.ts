import { createSignal } from 'solid-js';

import { request } from '../socket/socket';

export type DictationPhase = 'idle' | 'recording' | 'transcribing';

/**
 * Records from the mic until `stop`, then turns it into text on the server.
 * One recorder per composer.
 */
export function createDictation(onText: (text: string) => void) {
  const [phase, setPhase] = createSignal<DictationPhase>('idle', {
    name: 'dictationPhase',
  });
  const [started, setStarted] = createSignal(0, { name: 'dictationStarted' });
  let recorder: MediaRecorder | undefined;
  let discard = false;
  let analyser: AnalyserNode | undefined;
  const samples = new Float32Array(512);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const meters = new AudioContext();
    // Created after an await, so iOS may start it suspended.
    void meters.resume();
    analyser = meters.createAnalyser();
    analyser.fftSize = 512;
    meters.createMediaStreamSource(stream).connect(analyser);
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    recorder = rec;
    discard = false;
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    rec.start();
    setStarted(Date.now());
    setPhase('recording');
    await done;
    for (const track of stream.getTracks()) track.stop();
    void meters.close();
    analyser = undefined;
    recorder = undefined;
    const blob = new Blob(chunks, { type: rec.mimeType });
    if (discard || !blob.size) return setPhase('idle');
    setPhase('transcribing');
    try {
      const audio = await blobToBase64(blob);
      const { text } = await request('voice.transcribe', {
        audio,
        mimeType: blob.type || 'audio/webm',
      });
      if (text) onText(text);
    } finally {
      setPhase('idle');
    }
  };

  return {
    phase,
    started,
    // The mic's loudness, 0 to 1, read per frame by the meter.
    level: () => {
      if (!analyser) return 0;
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += s * s;
      return Math.min(1, Math.sqrt(sum / samples.length) * 6);
    },
    // Starts, or stops and transcribes; resolves once the text is in.
    toggle: () => {
      if (recorder) return recorder.stop();
      if (phase() === 'idle') return start();
    },
    cancel: () => {
      discard = true;
      recorder?.stop();
    },
  };
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
