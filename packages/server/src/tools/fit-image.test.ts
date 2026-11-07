import { expect, test } from 'bun:test';
import { DEFAULT_IMAGE_LIMITS as limits } from '@earendil-works/pi-durable/tools';

import { bunImages } from './fit-image';

// A noisy 24-bit BMP: Bun decodes BMP, and noise defeats PNG compression.
function bmp(width: number, height: number) {
  const row = Math.ceil((width * 3) / 4) * 4;
  const bytes = new Uint8Array(54 + row * height);
  const view = new DataView(bytes.buffer);
  bytes.set([0x42, 0x4d]);
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  for (let i = 54; i < bytes.length; i += 65536)
    crypto.getRandomValues(
      bytes.subarray(i, Math.min(i + 65536, bytes.length)),
    );
  return bytes;
}

test('an image the model already takes reaches it unchanged', async () => {
  const png = await new Bun.Image(bmp(100, 80)).png().bytes();
  const kept = await bunImages.prepare(png, 'image/png', limits);
  expect(kept?.data).toBe(Buffer.from(png).toString('base64'));
});

test('a huge photo in a format models refuse is converted and shrunk to fit', async () => {
  const big = await bunImages.prepare(bmp(4000, 3000), 'image/bmp', limits);
  expect(['image/png', 'image/jpeg']).toContain(big!.mimeType);
  expect(big!.resized!.to.width).toBeLessThanOrEqual(limits.maxWidth);
  expect(big!.resized!.to.height).toBeLessThanOrEqual(limits.maxHeight);
  expect(big!.data.length).toBeLessThanOrEqual(limits.maxBytes);
});
