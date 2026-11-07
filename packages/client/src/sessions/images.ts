import type { PromptImage } from '@bica/shared/protocol';

// What models take as is; anything else the browser can decode is converted.
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
// Models scale bigger images down themselves; sending less keeps
// transcripts light, and stays under provider caps (Anthropic: 5 MB base64).
const MAX_SIDE = 2000;
const MAX_BYTES = 3_500_000;

/** A pasted or picked file, ready to send: small enough, a type models take. */
export async function toPromptImage(file: File): Promise<PromptImage> {
  if (!file.type.startsWith('image/'))
    throw new Error(`${file.name || 'That file'} is not an image`);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`Can't read ${file.name || 'that image'}`);
  });
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  if (scale === 1 && TYPES.includes(file.type) && file.size <= MAX_BYTES) {
    bitmap.close();
    return { mimeType: file.type, data: await base64(file) };
  }

  // Animated GIFs keep only their first frame; fine for a prompt.
  const canvas = new OffscreenCanvas(
    Math.round(width * scale),
    Math.round(height * scale),
  );
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // PNG keeps screenshots sharp; photos that stay too big become JPEG.
  // A JPEG is a photo already, so it skips the PNG try: on a phone, encoding
  // a big PNG for nothing takes seconds.
  const photo = file.type === 'image/jpeg' || file.type.startsWith('image/hei');
  let blob = photo
    ? undefined
    : await canvas.convertToBlob({ type: 'image/png' });
  if (!blob || blob.size > MAX_BYTES) {
    // JPEG has no transparency: put white behind it, not black.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  }
  return { mimeType: blob.type, data: await base64(blob) };
}

/** A sent image comes by its file over HTTP, cached for good (server/src/sessions/attachments.ts). */
export function imageUrl(image: PromptImage) {
  if (!image.data && image.file)
    return `/attachment/${image.file.split(/[\\/]/).pop()}`;
  return `data:${image.mimeType};base64,${image.data}`;
}

/** Full size in a new tab; browsers won't open data: URLs there. */
export function openImage(image: PromptImage) {
  if (!image.data) return void open(imageUrl(image), '_blank');
  const bytes = Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: image.mimeType }));
  open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function base64(blob: Blob) {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return url.slice(url.indexOf(',') + 1);
}
