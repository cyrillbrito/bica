import type { SettingsChange } from '@bica/shared/protocol';
import { request, useTopic } from './socket/socket';
import { track } from './telemetry/telemetry';

/** Bica's settings, the same on every device. */
export function useSettings() {
  return useTopic('settings', () => ({}));
}

export function updateSettings(change: SettingsChange) {
  // Turning usage data off sends nothing, not even that.
  const [setting, value] = Object.entries(change)[0] ?? [];
  if (setting && setting !== 'telemetry')
    track('setting_change', {
      setting,
      ...(typeof value === 'boolean' && { value: String(value) }),
    });
  return request('settings.update', change);
}
