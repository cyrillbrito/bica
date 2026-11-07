import { Dynamic } from '@solidjs/web';
import { Show } from 'solid-js';

import { splitBranch, ticketUrl } from './branch';

/**
 * A branch as you scan it: the ticket shrinks to a small tag with just its
 * number, and a prefix like "me/" is left out. The full name is the tooltip.
 */
export default function BranchName(props: {
  branch: string;
  // The project's ticket link template; without it the tag isn't a link.
  tickets?: string;
  class?: string;
}) {
  const parts = () => splitBranch(props.branch);
  return (
    <span
      // Clipped, so a ticket tag with no room left can't spill under what
      // follows (a PR badge); the name beside it truncates first.
      class={['flex min-w-0 items-center gap-1 overflow-hidden', props.class]}
      title={props.branch}
    >
      <Show when={parts().ticket}>
        {(ticket) => {
          const url = () => ticketUrl(props.tickets, ticket());
          return (
            <Dynamic
              component={url() ? 'a' : 'span'}
              class={[
                'shrink-0 rounded-sm bg-hover px-1 font-mono text-meta text-muted tabular-nums',
                url() && 'hover:text-fg hover:underline',
              ]}
              href={url()}
              target={url() ? '_blank' : undefined}
              rel={url() ? 'noreferrer' : undefined}
              title={ticket()}
              onClick={(e: MouseEvent) => url() && e.stopPropagation()}
            >
              {ticket().slice(ticket().lastIndexOf('-') + 1)}
            </Dynamic>
          );
        }}
      </Show>
      <Show when={parts().rest || !parts().ticket}>
        <span class="min-w-0 truncate font-mono">{parts().rest}</span>
      </Show>
    </span>
  );
}
