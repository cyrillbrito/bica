import { paths } from '../router';
import { Button } from '../ui/Button';
import { CloseIcon, WatchIcon } from '../ui/icons';
import { Strip } from '../ui/Strip';

/**
 * A line on the composer's tray of a session the hub watches: it hears each
 * run this one ends (docs/hub.md). Stop ends the watch, and the hub hears so.
 */
export default function WatchStrip(props: { onStop: () => void }) {
  return (
    <Strip
      icon={<WatchIcon />}
      label={
        <a class="transition-colors hover:text-fg" href={paths.hub()}>
          Hub watching
        </a>
      }
      action={
        <Button
          size="sm"
          variant="ghost"
          title="The hub hears no more of this session's turns"
          onClick={() => props.onStop()}
        >
          <CloseIcon />
          Stop
        </Button>
      }
    />
  );
}
