import { For } from 'solid-js';
import type { SessionStatus } from '@bica/shared/protocol';
import StatusDot, { STATUS, StatusTag } from '@client/sessions/StatusDot';
import { mount } from './mount';

const STATUSES: SessionStatus[] = [
  'running',
  'retrying',
  'waiting',
  'error',
  'done',
  'idle',
];

// The six statuses as the sidebar draws them, with their tags and times.
function StatusDemo() {
  const now = Date.now();
  return (
    <div class="flex flex-col gap-1 rounded-lg border border-line bg-panel p-2">
      <For each={STATUSES}>
        {(status) => (
          <div class="flex h-7 items-center gap-2 rounded-md px-2 hover:bg-hover">
            <StatusDot status={status} />
            <span class="min-w-0 flex-1 truncate">{STATUS[status].label}</span>
            <StatusTag
              status={status}
              since={now - 83_000}
              updatedAt={now - 3_600_000}
            />
          </div>
        )}
      </For>
    </div>
  );
}

export default (host: HTMLElement) => mount(host, () => <StatusDemo />);
