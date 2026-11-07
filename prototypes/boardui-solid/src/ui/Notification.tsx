// Port of BoardUI's notification/notification.tsx (MIT). Framer Motion's
// enter/exit and layout springs became CSS keyframes, and the portal became
// Solid's <Portal>. `toast()` is the prototype's own small queue.
import type { JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
import { For, Show, createSignal, onSettled } from 'solid-js';

import { Avatar, type AvatarColor } from './display';
import { Button, CloseButton, type ButtonVariant } from './buttons';
import { cx } from './cx';
import { Glyph, type IconComponent } from './icon';
import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiInformationFill,
  RiNotification3Fill,
} from './icons';

export type NotificationStatus =
  | 'neutral'
  | 'information'
  | 'success'
  | 'error';

const STATUS_ICON: Record<NotificationStatus, IconComponent> = {
  neutral: RiNotification3Fill,
  information: RiInformationFill,
  success: RiCheckboxCircleFill,
  error: RiErrorWarningFill,
};

const status = {
  neutral: 'bg-background-tertiary-default text-text-secondary',
  information:
    'bg-notification-information-background text-notification-information-foreground',
  success:
    'bg-notification-success-background text-notification-success-foreground',
  error: 'bg-notification-error-background text-notification-error-foreground',
};

export type NotificationProps = {
  title: string;
  description?: string;
  timestamp?: string;
  status?: NotificationStatus;
  icon?: IconComponent;
  avatar?: {
    initials: string;
    color?: AvatarColor;
    presence?: 'online' | 'busy' | 'offline';
  };
  actions?: { label: string; onClick?: () => void; variant?: ButtonVariant }[];
  dismissible?: boolean;
  /** Milliseconds until it dismisses itself, with a draining bar. */
  autoDismiss?: number;
  onDismiss?: () => void;
  class?: string;
};

export function Notification(props: NotificationProps) {
  const [leaving, setLeaving] = createSignal(false);
  const [gone, setGone] = createSignal(false);
  const s = () => props.status ?? 'neutral';
  const dismiss = () => {
    setLeaving(true);
    setTimeout(() => {
      setGone(true);
      props.onDismiss?.();
    }, 180);
  };
  onSettled(() => {
    if (!props.autoDismiss) return;
    const t = setTimeout(dismiss, props.autoDismiss);
    return () => clearTimeout(t);
  });

  return (
    <Show when={!gone()}>
      <div
        role={s() === 'error' ? 'alert' : 'status'}
        class={cx(
          'relative flex w-full items-start gap-3 overflow-hidden p-4 pe-11',
          'rounded-2xl border border-border-button-default bg-background-primary-default shadow-dropdown',
          'transition-[opacity,translate,scale,filter] duration-180 ease-out',
          leaving() && 'translate-y-2 scale-[0.96] opacity-0 blur-[3px]',
          props.class,
        )}
      >
        <Show
          when={props.avatar}
          fallback={
            <span
              class={cx(
                'relative flex size-10 shrink-0 items-center justify-center rounded-full',
                status[s()],
              )}
            >
              <Glyph of={props.icon ?? STATUS_ICON[s()]} class="size-5" />
            </span>
          }
        >
          {(a) => (
            <span class="relative shrink-0">
              <Avatar
                size="lg"
                initials={a().initials}
                color={a().color}
                class="size-10"
              />
              <Show when={a().presence}>
                <span
                  aria-hidden="true"
                  class={cx(
                    'absolute end-0 bottom-0 size-3 rounded-full border-2 border-background-primary-default',
                    a().presence === 'online'
                      ? 'bg-lime-500'
                      : a().presence === 'busy'
                        ? 'bg-rose-500'
                        : 'bg-background-quaternary-hover',
                  )}
                />
              </Show>
            </span>
          )}
        </Show>
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p class="text-body-medium text-text-primary">{props.title}</p>
            <Show when={props.timestamp}>
              <span class="text-body-regular text-text-tertiary">
                {props.timestamp}
              </span>
            </Show>
          </div>
          <Show when={props.description}>
            <p class="text-body-regular text-text-secondary">
              {props.description}
            </p>
          </Show>
          <Show when={props.actions?.length}>
            <div class="mt-1.5 flex flex-wrap items-center gap-2">
              <For each={props.actions}>
                {(action, i) => (
                  <Button
                    size="small"
                    variant={
                      action.variant ?? (i() === 0 ? 'secondary' : 'primary')
                    }
                    onClick={() => action.onClick?.()}
                  >
                    {action.label}
                  </Button>
                )}
              </For>
            </div>
          </Show>
        </div>
        <Show when={props.dismissible ?? true}>
          <CloseButton
            size="xs"
            aria-label="Dismiss notification"
            onClick={dismiss}
            class="absolute top-3 end-3"
          />
        </Show>
        <Show when={props.autoDismiss}>
          <span
            aria-hidden="true"
            class="bui-drain absolute inset-x-0 bottom-0 h-[3px] origin-left bg-accent-600"
            style={{ 'animation-duration': `${props.autoDismiss}ms` }}
          />
        </Show>
      </div>
    </Show>
  );
}

/* ------------------------------------------------------------------ toasts */

type Toast = NotificationProps & { id: number };
const [toasts, setToasts] = createSignal<Toast[]>([]);
let nextId = 0;

/** Shows a notification in the bottom-end corner. */
export function toast(n: NotificationProps) {
  const id = ++nextId;
  setToasts((list) => [...list, { autoDismiss: 5000, ...n, id }]);
}

export function NotificationViewport(): JSX.Element {
  return (
    <Portal>
      <div
        aria-label="Notifications"
        class="pointer-events-none fixed end-3 bottom-3 z-100 flex w-[min(400px,calc(100vw-24px))] flex-col items-end gap-3 sm:end-6 sm:bottom-6"
      >
        <For each={toasts()} keyed={(t) => t.id}>
          {(t) => (
            <div class="bui-toast-in pointer-events-auto w-full">
              <Notification
                {...t()}
                onDismiss={() =>
                  setToasts((list) => list.filter((x) => x.id !== t().id))
                }
              />
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
}
