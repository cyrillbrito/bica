import type { SessionSummary } from '@bica/shared/protocol';
import { paths } from '../router';
import { Button } from '../ui/Button';
import { DetachIcon, ParentIcon } from '../ui/icons';
import { Strip } from '../ui/Strip';

/**
 * A line above a child session's composer, or a terminal a session started: a
 * link to its parent, and Detach, which makes it yours for good. The parent's
 * title stays out of sentences, since titles run long.
 */
export default function ParentStrip(props: {
  parent: SessionSummary | undefined;
  onDetach: () => void;
  /** What Detach does, on hover. */
  detachTitle?: string;
}) {
  return (
    <Strip
      tone="accent"
      icon={<ParentIcon />}
      label="Parent in charge"
      action={
        <Button
          size="sm"
          variant="outline"
          title={
            props.detachTitle ??
            "Take it from its parent: it's yours, and the parent hears no more of it"
          }
          onClick={() => props.onDetach()}
        >
          <DetachIcon />
          Detach
        </Button>
      }
    >
      <a
        class="min-w-0 truncate text-muted transition-colors hover:text-fg"
        href={props.parent ? paths.s(props.parent.id)() : undefined}
        title={props.parent?.title ? `Open ${props.parent.title}` : undefined}
      >
        {props.parent?.title || 'Untitled session'}
      </a>
    </Strip>
  );
}
