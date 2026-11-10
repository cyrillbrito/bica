import { AlertIcon } from '../ui/icons';
import { Strip } from '../ui/Strip';

/**
 * On the composer's tray of a session whose work Pi Durable won't run because
 * its code is gone (docs/sessions.md). Stop, next to the composer, ends it.
 */
export default function StuckStrip() {
  return (
    <Strip
      tone="danger"
      icon={<AlertIcon />}
      label="Stuck: its code is gone from Bica. Stop ends it"
    />
  );
}
