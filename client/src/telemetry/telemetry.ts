import { useTopicWhenReady } from '../socket/socket';

/**
 * Whether telemetry is on, and why not, with what posthog-js needs: the key,
 * the relay, and the install id (docs/telemetry.md). Undefined until the
 * server answers, never an old copy.
 */
export function useTelemetry() {
  return useTopicWhenReady('telemetry', () => ({}));
}
