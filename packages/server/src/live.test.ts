import { expect, test } from 'bun:test';

import { live } from './live';

// Polled topics refresh on a timer; a read slower than the timer must not
// queue reads behind it, or anything awaiting a refresh waits for them all.
test('refreshes during a slow read share one read, and a change made mid-read still lands', async () => {
  let value = 'before';
  let reads = 0;
  let gate = Promise.resolve();
  const topic = live(async () => {
    reads++;
    const seen = value;
    await gate;
    return seen;
  });
  const values: string[] = [];
  const stop = await topic.watch((v) => values.push(v));

  const held = Promise.withResolvers<void>();
  gate = held.promise;
  reads = 0;
  const slow = topic.refresh();
  // The slow read starts before the change.
  await new Promise((resolve) => setImmediate(resolve));
  value = 'after';
  const ticks = Array.from({ length: 50 }, () => topic.refresh());
  held.resolve();
  await Promise.all([slow, ...ticks]);

  expect(values).toEqual(['before', 'after']);
  expect(reads).toBe(2);
  stop();
});
