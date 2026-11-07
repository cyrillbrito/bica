import { useEffect, useRef } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  RiArchiveLine,
  RiEditLine,
  RiGitForkLine,
  RiMailUnreadLine,
  RiMore2Fill,
} from '@remixicon/react';
import {
  Dropdown,
  DropdownItem,
  DropdownPopover,
  DropdownTrigger,
} from '@/components/base/dropdown/dropdown';
import { Chip } from '@/components/base/badges/chip';
import { Page } from '@/app/Page';
import { NotFound } from '@/app/NotFound';
import {
  sessionById,
  TRANSCRIPTS,
  workspaceById,
  workspaceLabel,
  type Session,
} from '@/fixtures';
import { Composer } from './Composer';
import { STATUS_LABEL } from './StatusIcon';
import { Transcript } from './Transcript';
import { useFakeTurn } from './useFakeTurn';

const STATUS_CHIP = {
  running: 'blue',
  waiting: 'yellow',
  idle: 'neutral',
  error: 'rose',
} as const;

function SessionMenu() {
  const items = [
    { label: 'Rename', icon: RiEditLine },
    { label: 'Fork', icon: RiGitForkLine },
    { label: 'Mark as unread', icon: RiMailUnreadLine },
    { label: 'Archive', icon: RiArchiveLine },
  ];
  return (
    <Dropdown>
      <DropdownTrigger
        aria-label="Session actions"
        className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-secondary-hover"
      >
        <RiMore2Fill aria-hidden className="size-5" />
      </DropdownTrigger>
      <DropdownPopover
        aria-label="Session actions"
        placement="bottom end"
        className="w-52"
      >
        {items.map(({ label, icon: I }) => (
          <DropdownItem key={label}>
            <I aria-hidden className="size-5 text-foreground-icon-secondary" />
            <span className="text-body-medium text-text-primary">{label}</span>
          </DropdownItem>
        ))}
      </DropdownPopover>
    </Dropdown>
  );
}

function SessionView({ session }: { session: Session }) {
  const workspace = workspaceById(session.workspace);
  const turn = useFakeTurn(
    TRANSCRIPTS[session.id] ?? [],
    session.status === 'running',
  );
  const scroller = useRef<HTMLDivElement>(null);

  // Follows the stream while it plays, as the real transcript does.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [turn.rows]);

  const status = turn.working ? 'running' : session.status;
  return (
    <Page
      title={session.title}
      crumb={
        workspace && session.workspace !== 'hub'
          ? workspaceLabel(workspace)
          : 'Hub'
      }
      badge={
        <Chip variant="caption" color={STATUS_CHIP[status]} className="py-0">
          {STATUS_LABEL[status]}
        </Chip>
      }
      actions={<SessionMenu />}
      workspace={
        workspace && session.workspace !== 'chats' ? workspace.id : undefined
      }
      bodyClassName="flex flex-col"
    >
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <Transcript
          rows={turn.rows}
          streaming={turn.streaming}
          working={turn.working}
        />
      </div>
      <div className="shrink-0 px-2 pb-2 sm:px-3 sm:pb-3">
        <div className="mx-auto w-full max-w-3xl">
          <Composer
            busy={!!turn.working}
            queue={turn.queue}
            model={session.model}
            branch={workspace?.branch || undefined}
            onSend={turn.send}
            onStop={turn.stop}
            onTake={turn.take}
          />
        </div>
      </div>
    </Page>
  );
}

export function SessionPage() {
  const { id } = useParams({ from: '/s/$id' });
  const session = sessionById(id);
  if (!session) return <NotFound />;
  // A new key per session resets the fake run when switching.
  return <SessionView key={session.id} session={session} />;
}
