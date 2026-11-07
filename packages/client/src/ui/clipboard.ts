import { toast } from './Toast';

/**
 * Copies text and says so, with a toast unless `quiet` (the button shows it
 * itself). `navigator.clipboard` needs a secure context, and a LAN address
 * isn't one.
 */
export async function copyText(text: string, { quiet = false } = {}) {
  try {
    await navigator.clipboard.writeText(text);
    if (!quiet) toast('Copied');
    return true;
  } catch {
    // Fall through to the legacy path.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok || !quiet) toast(ok ? 'Copied' : "Couldn't copy");
  return ok;
}
