import { useParams } from '@tanstack/react-router';
import { RiRestartLine, RiStopFill } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import { Page } from '@/app/Page';
import { NotFound } from '@/app/NotFound';
import {
  TERMINALS,
  TERMINAL_OUTPUT,
  workspaceById,
  workspaceLabel,
} from '@/fixtures';

const KEYS = ['Esc', 'Tab', 'Ctrl-C', '←', '↑', '↓', '→'];

/** A shared shell, full size, with static output in place of ghostty-web. */
export function TerminalPage() {
  const { id } = useParams({ from: '/t/$id' });
  const terminal = TERMINALS.find((t) => t.id === id);
  if (!terminal) return <NotFound />;
  const workspace = workspaceById(terminal.workspace);
  return (
    <Page
      title={terminal.name}
      crumb={workspace && workspaceLabel(workspace)}
      badge={
        <Chip
          variant="caption"
          color={terminal.running ? 'lime' : 'neutral'}
          className="py-0"
        >
          {terminal.running ? 'Running' : 'Exited 0'}
        </Chip>
      }
      actions={
        <>
          <Button variant="secondary" size="small" leadingIcon={RiRestartLine}>
            <span className="hidden sm:inline">Restart</span>
          </Button>
          {terminal.running && (
            <Button variant="secondary" size="small" leadingIcon={RiStopFill}>
              <span className="hidden sm:inline">Stop</span>
            </Button>
          )}
        </>
      }
      bodyClassName="flex flex-col p-2 sm:p-3"
    >
      <pre className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border-button-default bg-well p-4 font-mono text-[13px] leading-5 text-text-primary shadow-xs">
        {terminal.running
          ? TERMINAL_OUTPUT
          : `$ ${terminal.command}\n\n12 pass\n0 fail\n\n[exited with code 0]\n`}
        <span className="inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-text-primary" />
      </pre>
      <div className="flex gap-1.5 overflow-x-auto pt-2 sm:hidden">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            className="shrink-0 rounded-lg border border-border-button-default bg-well px-3 py-1.5 font-mono text-body-2-medium text-text-primary shadow-xs"
          >
            {k}
          </button>
        ))}
      </div>
    </Page>
  );
}
