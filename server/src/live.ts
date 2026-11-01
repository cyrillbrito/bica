/**
 * A value that browsers watch and the server re-reads when it may have
 * changed. Watchers share one read; they hear only real changes. `start`
 * runs while anyone watches and calls `refresh` when to look again
 * (a timer, harness commits); it returns how to stop.
 */
export function live<T>(
  read: () => Promise<T>,
  start?: (refresh: () => void) => () => void,
) {
  const listeners = new Set<(value: T) => void>();
  let last: string | undefined;
  let stop: (() => void) | undefined;
  // One read at a time, so an older value never lands after a newer one.
  let reading = Promise.resolve();
  // A read not yet started covers every refresh asked before it starts, so
  // a read slower than its timer can't queue up more behind it.
  let waiting: Promise<void> | undefined;

  const refresh = () =>
    (waiting ??= reading = reading.then(async () => {
      waiting = undefined;
      if (!listeners.size) return;
      try {
        const value = await read();
        const json = JSON.stringify(value);
        if (json === last) return;
        last = json;
        for (const listener of listeners) listener(value);
      } catch (error) {
        console.error('[live]', error);
      }
    }));

  async function watch(listener: (value: T) => void) {
    // Read first: a failure leaves nothing behind to clean up.
    const value = await read();
    listeners.add(listener);
    if (!stop) {
      last = JSON.stringify(value);
      stop = start?.(() => void refresh()) ?? (() => {});
    }
    listener(value);
    return () => {
      listeners.delete(listener);
      if (listeners.size) return;
      stop?.();
      stop = undefined;
    };
  }

  return { watch, refresh };
}

export type Live<T> = ReturnType<typeof live<T>>;

/**
 * One live value per key, such as a folder, re-read every `ms` while anyone
 * watches it. Kept once made: an unwatched one is just an object, no timer.
 */
export function polled<T>(ms: number, read: (key: string) => Promise<T>) {
  const topics = new Map<string, Live<T>>();
  return {
    get(key: string) {
      let topic = topics.get(key);
      if (!topic) {
        topic = live(
          () => read(key),
          (refresh) => {
            const timer = setInterval(refresh, ms);
            return () => clearInterval(timer);
          },
        );
        topics.set(key, topic);
      }
      return topic;
    },
    /** Re-read now instead of at the next tick; nothing if never watched. */
    refresh(key: string) {
      return topics.get(key)?.refresh();
    },
    keys: () => topics.keys(),
  };
}
