import { stored } from './stored';

// Per device: the laptop may chime while the phone stays quiet.
const [soundOn, save] = stored('sound', true);
export { soundOn };

export function setSoundOn(on: boolean) {
  save(on);
  if (on) play('done');
}

export type Chime = 'done' | 'waiting' | 'error' | 'cheer';

// [frequency Hz, start s] per note: rising for done, a double tap when it
// needs you, falling when it failed.
const NOTES: Record<Chime, [number, number][]> = {
  done: [
    [659.25, 0],
    [987.77, 0.09],
  ],
  waiting: [
    [880, 0],
    [880, 0.14],
  ],
  error: [
    [392, 0],
    [261.63, 0.12],
  ],
  // A major arpeggio: a session got compacted.
  cheer: [
    [523.25, 0],
    [659.25, 0.08],
    [783.99, 0.16],
    [1046.5, 0.24],
  ],
};

export function cheer() {
  if (soundOn()) play('cheer');
}

let ctx: AudioContext | undefined;

// Synthesized, so there is no asset to load. Browsers only let audio start
// once the page has had a click or key press; before that this stays silent.
export function play(chime: Chime) {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  const now = ctx.currentTime;
  for (const [freq, at] of NOTES[chime]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + at);
    gain.gain.linearRampToValueAtTime(0.18, now + at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.5);
  }
}
