import { useCallback, useEffect, useRef, useState } from 'react';
import { SCRIPT, WORKING_PHRASES, type Row } from '@/fixtures';

export type Queued = { id: number; text: string; mode: 'steer' | 'queue' };

/**
 * Plays SCRIPT on a timer after each prompt: a thought and tool calls one by
 * one, then a reply that types in. Nothing leaves the browser.
 */
export function useFakeTurn(initial: Row[], autoplay: boolean) {
  const [rows, setRows] = useState(initial);
  const [working, setWorking] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [queue, setQueue] = useState<Queued[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const nextId = useRef(1);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, fn: () => void) =>
    timers.current.push(setTimeout(fn, ms));

  const play = useCallback(function play(prompt?: string) {
    clear();
    if (prompt) setRows((r) => [...r, { kind: 'prompt', text: prompt }]);
    setWorking(
      WORKING_PHRASES[Math.floor(Math.random() * WORKING_PHRASES.length)]!,
    );
    setStreaming(true);
    let t = 700;
    SCRIPT.tools.forEach((tool, i) => {
      later(t, () =>
        setRows((r) => {
          const tools = SCRIPT.tools.slice(0, i + 1);
          const row: Row = {
            kind: 'activity',
            seconds: 12,
            thought: SCRIPT.thought,
            tools,
          };
          return i === 0 ? [...r, row] : [...r.slice(0, -1), row];
        }),
      );
      t += 900;
    });
    later(t, () => setRows((r) => [...r, { kind: 'reply', text: '' }]));
    const words = SCRIPT.reply.split(/(?<=\s)/);
    for (let n = 1; n <= words.length; n += 2) {
      t += 45;
      const text = words.slice(0, n + 1).join('');
      later(t, () =>
        setRows((r) => [...r.slice(0, -1), { kind: 'reply', text }]),
      );
    }
    later(t + 100, () => {
      setStreaming(false);
      setWorking(null);
      const [next, ...rest] = queueRef.current;
      if (next) {
        setQueue(rest);
        later(400, () => play(next.text));
      }
    });
  }, []);

  useEffect(() => {
    if (autoplay) play();
    return clear;
  }, [autoplay, play]);

  const send = (text: string, mode: Queued['mode'] = 'steer') => {
    if (!working) return play(text);
    setQueue((q) => [...q, { id: nextId.current++, text, mode }]);
  };

  const stop = () => {
    clear();
    setStreaming(false);
    setWorking(null);
  };

  const take = (id: number) => {
    const item = queue.find((q) => q.id === id);
    setQueue((q) => q.filter((x) => x.id !== id));
    return item?.text ?? '';
  };

  return { rows, streaming, working, queue, send, stop, take };
}
