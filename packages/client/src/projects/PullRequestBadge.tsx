import { Dynamic } from '@solidjs/web';

import type { JSX } from '@solidjs/web';

import type { PullRequest } from '@bica/shared/protocol';
import { tagClass, type Tone } from '../ui/Tag';
import {
  MergedIcon,
  PullRequestClosedIcon,
  PullRequestDraftIcon,
  PullRequestIcon,
} from '../ui/icons';

const STATES: Record<
  PullRequest['state'],
  { icon: () => JSX.Element; class: string; tone: Tone; label: string }
> = {
  open: {
    icon: PullRequestIcon,
    class: 'text-running',
    tone: 'running',
    label: 'Open',
  },
  draft: {
    icon: PullRequestDraftIcon,
    class: 'text-muted',
    tone: 'neutral',
    label: 'Draft',
  },
  merged: {
    icon: MergedIcon,
    class: 'text-merged',
    tone: 'merged',
    label: 'Merged',
  },
  closed: {
    icon: PullRequestClosedIcon,
    class: 'text-danger',
    tone: 'danger',
    label: 'Closed',
  },
};

export default function PullRequestBadge(props: {
  pr: PullRequest;
  class?: string;
  // Inside another link: no link of its own.
  plain?: boolean;
  // A tinted tag that names the state too (affectUI's Project Card status).
  pill?: boolean;
}) {
  const state = () => STATES[props.pr.state];
  return (
    <Dynamic
      component={props.plain ? 'span' : 'a'}
      class={[
        props.pill
          ? `${tagClass(state().tone)} pl-1 tabular-nums transition-[filter] hover:brightness-110`
          : `inline-flex shrink-0 items-center gap-1 rounded-sm font-mono text-meta tabular-nums [&_svg]:size-3.5 ${state().class}`,
        !props.plain && !props.pill && 'hover:underline',
        props.class,
      ]}
      href={props.plain ? undefined : props.pr.url}
      target={props.plain ? undefined : '_blank'}
      rel={props.plain ? undefined : 'noreferrer'}
      title={`${state().label}: ${props.pr.title}`}
      onClick={(e: MouseEvent) => !props.plain && e.stopPropagation()}
    >
      <Dynamic component={state().icon} />
      {props.pill
        ? `${state().label} #${props.pr.number}`
        : `#${props.pr.number}`}
    </Dynamic>
  );
}
