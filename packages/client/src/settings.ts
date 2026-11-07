import type { SettingsChange } from '@bica/shared/protocol';
import { request, useTopic } from './socket/socket';

/** Bica's settings, the same on every device. */
export function useSettings() {
  return useTopic('settings', () => ({}));
}

export function updateSettings(change: SettingsChange) {
  return request('settings.update', change);
}
