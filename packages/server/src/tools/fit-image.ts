import type { ImageProcessor } from '@earendil-works/pi-durable/tools';

const INLINE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
// Limits count base64, which is 4/3 of the bytes.
function bytesOf(base64Bytes: number) {
  return Math.floor((base64Bytes * 3) / 4);
}

/**
 * `read`'s image processor on Bun.Image, so the binary needs no Photon wasm:
 * an image that fits goes as is, else a smaller PNG, or a JPEG if that is
 * still too big. Other formats, like BMP, become PNG.
 */
export const bunImages: ImageProcessor = {
  async prepare(bytes, mimeType, limits) {
    try {
      const { width, height } = await new Bun.Image(bytes).metadata();
      const maxBytes = bytesOf(limits.maxBytes);
      const fits = width <= limits.maxWidth && height <= limits.maxHeight;
      if (fits && INLINE.has(mimeType) && bytes.byteLength <= maxBytes)
        return { data: base64(bytes), mimeType };
      const small = () =>
        new Bun.Image(bytes).resize(limits.maxWidth, limits.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      let out = await small().png().bytes();
      let type = 'image/png';
      if (out.byteLength > maxBytes) {
        out = await small().jpeg({ quality: 85 }).bytes();
        type = 'image/jpeg';
      }
      if (out.byteLength > maxBytes) return undefined;
      const to = await new Bun.Image(out).metadata();
      return {
        data: base64(out),
        mimeType: type,
        ...(fits
          ? {}
          : {
              resized: {
                from: { width, height },
                to: { width: to.width, height: to.height },
              },
            }),
        ...(type !== mimeType && { convertedFrom: mimeType }),
      };
    } catch {
      return undefined;
    }
  },
};

function base64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64');
}
