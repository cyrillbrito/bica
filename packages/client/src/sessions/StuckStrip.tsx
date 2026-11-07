import { createSignal, Show } from 'solid-js';

import type { Stuck } from '@bica/shared/protocol';
import { retrySession } from './sessions';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { AlertIcon, RestoreIcon } from '../ui/icons';
import { Strip } from '../ui/Strip';

/**
 * On the composer's tray of a session whose work Pi Durable won't run
 * (docs/sessions.md): why, and Retry when crashes paused it. Stop, next to
 * the composer, ends it either way.
 */
export default function StuckStrip(props: { id: string; stuck: Stuck }) {
  const [busy, setBusy] = createSignal(false, { name: 'retryBusy' });
  const retry = async () => {
    setBusy(true);
    try {
      await retrySession(props.id);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Strip
      tone="danger"
      icon={<AlertIcon />}
      label={
        props.stuck === 'crashed'
          ? 'Paused after crashing Bica again and again'
          : 'Stuck: its code is gone from Bica. Stop ends it'
      }
      action={
        <Show when={props.stuck === 'crashed'}>
          <Button
            size="sm"
            variant="outline"
            title="Run it again; Stop ends it instead"
            loading={busy()}
            onClick={() => void retry()}
          >
            <RestoreIcon />
            Retry
          </Button>
        </Show>
      }
    />
  );
}
