import {
  RiChat3Line,
  RiErrorWarningFill,
  RiLoader4Line,
  RiQuestionFill,
} from '@remixicon/react';
import type { Session } from '@/fixtures';
import { cx } from '@/utils/cx';

export const STATUS_LABEL: Record<Session['status'], string> = {
  running: 'Running',
  waiting: 'Waiting for you',
  idle: 'Idle',
  error: 'Failed',
};

/** The icon slot of a session row: what the session is doing. */
export function StatusIcon({
  session,
  selected = false,
  className,
}: {
  session: Session;
  selected?: boolean;
  className?: string;
}) {
  const base = cx('size-5 shrink-0', className);
  if (session.status === 'running')
    return (
      <RiLoader4Line
        aria-label="Running"
        className={cx(
          base,
          'animate-spin',
          selected ? 'text-white' : 'text-accent-500',
        )}
      />
    );
  if (session.status === 'waiting')
    return (
      <RiQuestionFill
        aria-label="Waiting for you"
        className={cx(base, selected ? 'text-white' : 'text-yellow-500')}
      />
    );
  if (session.status === 'error')
    return (
      <RiErrorWarningFill
        aria-label="Failed"
        className={cx(base, selected ? 'text-white' : 'text-rose-500')}
      />
    );
  return (
    <span className={cx(base, 'relative flex items-center justify-center')}>
      <RiChat3Line
        aria-hidden
        className={cx(
          'size-5',
          selected ? 'text-white' : 'text-foreground-icon-tertiary',
        )}
      />
      {session.unread && (
        <span
          aria-label="Unread"
          className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-accent-500 ring-2 ring-background-secondary-default"
        />
      )}
    </span>
  );
}
