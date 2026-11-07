import { createSignal } from 'solid-js';

import { useSettings } from '../settings';
import { tonightAction } from './sessions';
import { IconButton } from '../ui/Button';
import { toast } from '../ui/Toast';
import { CloseIcon, MoonIcon } from '../ui/icons';
import { Strip } from '../ui/Strip';

/**
 * On the composer's tray of a session held for tonight (docs/night-runs.md):
 * when it starts, and × to cancel. The prompt itself is in the composer, which
 * saves edits as you type and runs it now.
 */
export default function TonightStrip(props: {
  id: string;
  // Before cancelling, so the composer keeps the prompt as a draft.
  onCancel: () => void;
}) {
  const settings = useSettings();
  const [busy, setBusy] = createSignal(false, { name: 'tonightBusy' });
  const cancel = async () => {
    setBusy(true);
    props.onCancel();
    try {
      await tonightAction(props.id, 'cancel');
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Strip
      tone="accent"
      icon={<MoonIcon />}
      label={`Runs tonight at ${settings().nightStart}`}
      action={
        <IconButton
          size="sm"
          title="Cancel the night run, keep the prompt as a draft"
          loading={busy()}
          onClick={() => void cancel()}
        >
          <CloseIcon />
        </IconButton>
      }
    />
  );
}
