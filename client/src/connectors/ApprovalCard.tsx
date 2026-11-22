import { For, Show, createSignal } from 'solid-js';

import type { ApprovalItem, ApprovalRequest } from '@bica/shared/requests';
import {
  RequestFooter,
  RequestHeader,
  RequestSheet,
  RequestTray,
  ResolvedRow,
} from '../requests/RequestCard';
import { Button, type Variant } from '../ui/Button';
import { ApprovalIcon, WarningIcon } from '../ui/icons';
import { toast } from '../ui/Toast';
import AppLogo from './AppLogo';
import { toolWords } from './connectors';

// Deny first and approve last, where the main action sits.
const ORDER: Record<string, number> = {
  deny: 0,
  always_approve: 1,
  approve: 2,
};

const DONE: Record<string, string> = {
  approve: 'Approved',
  always_approve: 'Always approved',
  deny: 'Denied',
};

/**
 * Calls to connected apps Composio holds for your yes, a request card like
 * the agent's questions. Red when an item deletes something, and then
 * Approve is the danger button. Writing to the session instead leaves it
 * unanswered, and the call doesn't run.
 */
export default function ApprovalCard(props: {
  request: ApprovalRequest;
  open: boolean;
  answer?: { text: string; value?: string };
  onAnswer: (value: string) => Promise<unknown>;
}) {
  const [answering, setAnswering] = createSignal<string | null>(null, {
    name: 'approvalAnswering',
  });
  const choices = () =>
    [...props.request.choices].sort(
      (a, b) => (ORDER[a.value] ?? 1) - (ORDER[b.value] ?? 1),
    );
  const variant = (value: string): Variant =>
    value === 'approve'
      ? props.request.danger
        ? 'danger'
        : 'soft'
      : value === 'deny'
        ? 'ghost'
        : 'outline';

  // Spins until the answer lands in the transcript and closes the card.
  const answer = (value: string) => {
    if (answering()) return;
    setAnswering(value);
    props.onAnswer(value).catch((error: unknown) => {
      setAnswering(null);
      toast.error(error);
    });
  };

  const items = () => props.request.items;
  return (
    <RequestTray
      open={props.open}
      label={props.open ? 'Needs your approval' : 'Approval'}
      busy={!!answering()}
      danger={props.request.danger}
      resolved={(seen) => (
        <ResolvedRow
          seen={seen}
          outcome={
            props.answer === undefined
              ? 'closed'
              : props.answer.value === 'deny'
                ? 'declined'
                : 'done'
          }
          summary={
            <>
              <span class="text-muted">
                {props.answer
                  ? (DONE[props.answer.value ?? ''] ?? props.answer.text)
                  : 'Not approved'}{' '}
              </span>
              {items()[0]?.tool
                ? toolWords(items()[0]!)
                : (items()[0]?.app ?? 'A connected app')}
              <Show when={items()[0]?.app && items()[0]?.tool}>
                <span class="text-muted"> in {items()[0]!.app}</span>
              </Show>
              <Show when={items().length > 1}>
                <span class="text-muted"> · +{items().length - 1} more</span>
              </Show>
            </>
          }
        >
          <For each={items()}>
            {(item) => <Item item={item} flag={items().length > 1} />}
          </For>
        </ResolvedRow>
      )}
    >
      <RequestHeader
        danger={props.request.danger}
        icon={
          <Show when={props.request.danger} fallback={<ApprovalIcon />}>
            <WarningIcon />
          </Show>
        }
        title={
          props.request.danger
            ? 'Deletes something: needs your approval'
            : 'Needs your approval'
        }
      />
      <RequestSheet danger={props.request.danger} class="gap-4">
        <For each={items()}>
          {(item) => <Item item={item} flag={items().length > 1} />}
        </For>
      </RequestSheet>
      <RequestFooter>
        <div class="flex flex-wrap justify-end gap-1.5">
          <For each={choices()}>
            {(choice) => (
              <Button
                variant={variant(choice.value)}
                loading={answering() === choice.value}
                disabled={!!answering() && answering() !== choice.value}
                onClick={() => answer(choice.value)}
              >
                {choice.label}
              </Button>
            )}
          </For>
        </div>
      </RequestFooter>
    </RequestTray>
  );
}

// flag: mark the item that deletes, when it isn't the only one.
function Item(props: { item: ApprovalItem; flag: boolean }) {
  const entries = () => Object.entries(props.item.args ?? {});
  return (
    <div class="flex min-w-0 flex-col gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <AppLogo name={props.item.app ?? '?'} logo={props.item.logo} />
        <Show
          when={props.item.tool}
          fallback={
            <span class="truncate font-medium">
              {props.item.app ?? 'A connected app'}
            </span>
          }
        >
          <span class="min-w-0 truncate">
            <span class="font-medium">{toolWords(props.item)}</span>
            <Show when={props.item.app}>
              <span class="text-muted"> in {props.item.app}</span>
            </Show>
          </span>
        </Show>
        <Show when={props.flag && props.item.danger}>
          <WarningIcon />
        </Show>
      </div>
      <Show
        when={props.item.tool}
        fallback={
          <p class="text-pretty whitespace-pre-wrap wrap-anywhere">
            {props.item.message}
          </p>
        }
      >
        <Show when={entries().length}>
          <dl class="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 max-sm:grid-cols-1 max-sm:gap-y-0.5">
            <For each={entries()}>
              {([key, value]) => (
                <>
                  <dt class="truncate text-meta leading-6 text-muted max-sm:leading-normal max-sm:not-first:mt-1.5">
                    {key}
                  </dt>
                  <dd class="min-w-0">
                    <Value value={value} />
                  </dd>
                </>
              )}
            </For>
          </dl>
        </Show>
      </Show>
    </div>
  );
}

// About six lines of text before a value folds.
const LONG = 320;

/** One argument: text wraps, objects show as JSON, and long ones fold. */
function Value(props: { value: unknown }) {
  const [open, setOpen] = createSignal(false, { name: 'approvalValueOpen' });
  // A list of plain values, such as ids, reads best on one line.
  const flat = () =>
    Array.isArray(props.value) &&
    props.value.every((v) => v === null || typeof v !== 'object');
  const json = () =>
    !flat() && props.value !== null && typeof props.value === 'object';
  const text = () =>
    flat()
      ? (props.value as unknown[]).map(String).join(', ')
      : json()
        ? JSON.stringify(props.value, null, 2)
        : props.value === null || props.value === undefined
          ? '—'
          : String(props.value as string | number | boolean | bigint);
  const long = () => text().length > LONG || text().split('\n').length > 6;
  return (
    <div class="flex flex-col items-start gap-0.5">
      <div
        class={[
          'w-full whitespace-pre-wrap wrap-anywhere',
          json() ? 'font-mono text-code leading-6' : 'leading-6',
          long() && !open() && 'line-clamp-6',
          (props.value === null || props.value === undefined) && 'text-muted',
        ]}
      >
        {text()}
      </div>
      <Show when={long()}>
        <button
          type="button"
          class="text-meta text-muted underline-offset-2 hover:text-fg hover:underline"
          aria-expanded={open() ? 'true' : 'false'}
          onClick={() => setOpen(!open())}
        >
          {open() ? 'Show less' : 'Show more'}
        </button>
      </Show>
    </div>
  );
}
