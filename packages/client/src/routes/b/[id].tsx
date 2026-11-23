import { Title } from '@solidjs/meta';
import { useNavigate, type RouteProps } from '@solidjs/router';
import { Show, createEffect } from 'solid-js';

import { openBotDialog } from '../../bots/BotDialog';
import { openBot, useBot, useBotSession } from '../../bots/bots';
import TopBar from '../../app/TopBar';
import Empty from '../../ui/Empty';
import { toast } from '../../ui/Toast';
import { paths } from '../../router';

/**
 * The way into a bot (docs/bots.md): lands on its session's page, starting
 * the session first if it has none.
 */
export default function BotPage(props: RouteProps<'/b/:id'>) {
  const navigate = useNavigate();
  const bot = useBot(() => props.params.id);
  const session = useBotSession(() => props.params.id);
  // One start per bot per visit: the session shows up in the list soon after.
  const started = new Set<string>();
  createEffect(
    () => ({ id: bot()?.id, session: session()?.id }),
    ({ id, session }) => {
      if (session) return navigate(paths.s(session)(), { replace: true });
      if (!id || started.has(id)) return;
      started.add(id);
      openBot(id)
        .then((s) => navigate(paths.s(s)(), { replace: true }))
        .catch((error: unknown) => {
          toast.error(error);
          openBotDialog(id);
        });
    },
    { name: 'openBot' },
  );

  return (
    <Show
      when={bot()}
      fallback={
        <>
          <Title>No such bot</Title>
          <TopBar />
          <Empty
            title="No such bot"
            action={
              <a class="text-accent-ink hover:underline" href={paths()}>
                Go home
              </a>
            }
          >
            It was deleted, or the link is old.
          </Empty>
        </>
      }
    >
      {(b) => (
        <>
          <Title>{b().name}</Title>
          <TopBar />
          <Empty>Starting {b().name}…</Empty>
        </>
      )}
    </Show>
  );
}
