import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  RiFileAddLine,
  RiFileReduceLine,
  RiFileTextLine,
} from '@remixicon/react';
import type { Change } from '@/fixtures';
import { cx } from '@/utils/cx';

export function LineCounts({
  added,
  removed,
}: {
  added: number;
  removed: number;
}) {
  return (
    <span className="flex shrink-0 gap-1.5 font-mono text-caption-1-medium tabular-nums">
      {added > 0 && <span className="text-lime-600">+{added}</span>}
      {removed > 0 && <span className="text-rose-500">−{removed}</span>}
    </span>
  );
}

function splitPath(path: string) {
  const i = path.lastIndexOf('/');
  return { name: path.slice(i + 1), dir: i < 0 ? '' : path.slice(0, i) };
}

/** A changed file: its name, folder, and lines; a click opens its diff. */
export function ChangeRow({
  change,
  workspace,
  action,
  onOpen,
}: {
  change: Change;
  workspace: string;
  action?: ReactNode;
  onOpen?: () => void;
}) {
  const { name, dir } = splitPath(change.path);
  const Icon =
    change.status === 'added'
      ? RiFileAddLine
      : change.status === 'deleted'
        ? RiFileReduceLine
        : RiFileTextLine;
  return (
    <div className="group/row relative flex items-center rounded-2lg hover:bg-background-secondary-hover">
      <Link
        to="/p/$id"
        params={{ id: workspace }}
        search={(prev) => ({ panel: prev.panel, diff: change.path })}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring rounded-2lg"
      >
        <Icon
          aria-hidden
          className={cx(
            'size-4 shrink-0',
            change.status === 'added'
              ? 'text-lime-600'
              : change.status === 'deleted'
                ? 'text-rose-500'
                : 'text-accent-500',
          )}
        />
        <span
          className={cx(
            'shrink-0 text-body-medium text-text-primary',
            change.status === 'deleted' && 'line-through',
          )}
        >
          {name}
        </span>
        <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-tertiary">
          {dir}
        </span>
        <LineCounts added={change.added} removed={change.removed} />
      </Link>
      {action && (
        <div className="absolute end-1 hidden items-center gap-0.5 rounded-lg bg-background-secondary-hover group-hover/row:flex">
          {action}
        </div>
      )}
    </div>
  );
}
