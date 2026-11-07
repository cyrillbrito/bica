import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { Show, createEffect, onSettled } from 'solid-js';

import HubBoard from '../hub/HubBoard';
import HubChat from '../hub/HubChat';
import StatusDot from '../sessions/StatusDot';
import VoiceSettings from '../voice/VoiceSettings';
import TopBar from '../app/TopBar';
import { IconButton } from '../ui/Button';
import Empty from '../ui/Empty';
import { openContextMenu } from '../ui/ContextMenu';
import { toast } from '../ui/Toast';
import { HubIcon, SettingsIcon, VoiceIcon } from '../ui/icons';
import { setNoPanels } from '../ui/layout';
import { request } from '../socket/socket';
import { useHub } from '../sessions/sessions';
import { paths } from '../router';

/**
 * The hub's own page (docs/hub.md): its board on top, the chat below.
 * The first visit starts it, or opens Settings when it has no folder yet.
 */
export default function Hub() {
  const hub = useHub();
  const navigate = useNavigate();
  onSettled(() => {
    setNoPanels(true);
    return () => setNoPanels(false);
  });
  let starting = false;
  createEffect(
    () => !hub(),
    (missing) => {
      if (!missing || starting) return;
      starting = true;
      request('hub.open', {}).catch((error: unknown) => {
        toast.error(error);
        navigate(`${paths.settings()}#hub`, { replace: true });
      });
    },
    { name: 'startHub' },
  );

  // The user mostly talks to the hub by voice, so its voice is set here.
  let voiceDialog: HTMLDialogElement | undefined;
  const menu = (e: MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(r.right - 200, r.bottom + 4, [
      {
        label: 'Voice settings',
        icon: <VoiceIcon />,
        disabled: !hub() && 'The hub is starting',
        onSelect: () => voiceDialog?.showModal(),
      },
      {
        label: 'Hub folder and model',
        icon: <SettingsIcon />,
        onSelect: () => navigate(`${paths.settings()}#hub`),
      },
    ]);
  };

  return (
    <>
      <Title>Hub</Title>
      <TopBar
        actions={
          <IconButton title="Hub settings" aria-haspopup="menu" onClick={menu}>
            <SettingsIcon />
          </IconButton>
        }
      >
        <span class="text-muted">
          <HubIcon />
        </span>
        <h1 class="font-semibold">Hub</h1>
        <Show when={hub() && hub()!.status !== 'idle' && hub()!.status}>
          {(status) => <StatusDot status={status()} />}
        </Show>
      </TopBar>
      <Show when={hub()} fallback={<Empty>Starting the hub…</Empty>}>
        {(h) => (
          <>
            <HubBoard hubId={h().id} />
            <HubChat id={h().id} />
            <VoiceSettings
              id={h().id}
              voice={h().voice}
              ref={(el) => (voiceDialog = el)}
            />
          </>
        )}
      </Show>
    </>
  );
}
