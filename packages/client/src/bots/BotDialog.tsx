import { useNavigate } from '@solidjs/router';
import { For, Show, createSignal } from 'solid-js';

import { BOT_COLORS, type BotColor } from '@bica/shared/bots';
import type { BotFiles } from '@bica/shared/protocol';
import {
  BOT_FILES,
  BOT_SWATCH,
  createBot,
  deleteBot,
  readBotFiles,
  updateBot,
  useBotSession,
  useBots,
} from './bots';
import Alert from '../ui/Alert';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import TextArea from '../ui/TextArea';
import { DrawnCheckIcon } from '../ui/icons';
import { errorText } from '../ui/errors';
import { isTouch } from '../ui/layout';
import { paths } from '../router';

let dialog: HTMLDialogElement | undefined;
const [botId, setBotId] = createSignal<string>();
const [confirming, setConfirming] = createSignal(false);

/**
 * Opens the bot dialog: a new bot with no id, else that bot's edit form, or
 * its delete confirmation with `{ delete: true }`.
 */
export function openBotDialog(id?: string, opts?: { delete?: boolean }) {
  setBotId(id);
  setConfirming(!!opts?.delete);
  dialog?.showModal();
}

const FILE_KEYS = ['instructions', 'soul', 'user'] as const;
const FILE_LABELS: Record<keyof BotFiles, string> = {
  instructions: 'Instructions',
  soul: 'Soul',
  user: 'About you',
};
const FILE_HINTS: Record<keyof BotFiles, string> = {
  instructions: 'What it does and how it works.',
  soul: 'How it talks: its tone, opinions, and boundaries.',
  user: 'What it knows about you, as Always, Never, and Prefer lines. It adds to this as it learns.',
};
const EMPTY_FILES: BotFiles = { instructions: '', soul: '', user: '' };

/**
 * Makes and edits bots (docs/bots.md), mounted once in App.tsx. Editing
 * also edits the files in its home; each saves only when the bot hasn't
 * changed it since the dialog read it.
 */
export default function BotDialog() {
  const bots = useBots();
  const navigate = useNavigate();
  const bot = () => bots().find((b) => b.id === botId());
  const session = useBotSession(botId);
  const [name, setName] = createSignal('', { name: 'botName' });
  const [color, setColor] = createSignal<BotColor>('blue', {
    name: 'botColor',
  });
  const [workspace, setWorkspace] = createSignal('', { name: 'botWorkspace' });
  const [home, setHome] = createSignal('', { name: 'botHome' });
  // What the files held when the dialog read them, and what's typed now.
  const [read, setRead] = createSignal<BotFiles>(EMPTY_FILES, {
    name: 'botFilesRead',
  });
  const [files, setFiles] = createSignal<BotFiles>(EMPTY_FILES, {
    name: 'botFiles',
  });
  const [loaded, setLoaded] = createSignal(false, { name: 'botFilesLoaded' });
  const [error, setError] = createSignal('', { name: 'botError' });
  const [busy, setBusy] = createSignal(false, { name: 'botBusy' });

  // Filled on open, so a feed update mid-edit doesn't undo what you typed.
  const fill = () => {
    setError('');
    setLoaded(false);
    setRead(EMPTY_FILES);
    setFiles(EMPTY_FILES);
    const b = bot();
    setName(b?.name ?? '');
    setColor(
      b?.color ??
        BOT_COLORS.find((c) => !bots().some((o) => o.color === c)) ??
        BOT_COLORS[bots().length % BOT_COLORS.length]!,
    );
    setWorkspace(b?.workspace ?? '');
    setHome(b?.home ?? '');
    if (!b) return;
    const id = b.id;
    readBotFiles(id)
      .then((f) => {
        if (botId() !== id) return;
        setRead(f);
        setFiles(f);
        setLoaded(true);
      })
      .catch((err: unknown) => setError(errorText(err)));
  };

  const save = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!name().trim() || !workspace().trim()) return;
    const edit = {
      name: name().trim(),
      color: color(),
      workspace: workspace().trim(),
      home: home().trim() || null,
    };
    setBusy(true);
    setError('');
    try {
      const b = bot();
      if (b) {
        const changed = Object.fromEntries(
          FILE_KEYS.filter((k) => files()[k] !== read()[k]).map((k) => [
            k,
            { before: read()[k], text: files()[k] },
          ]),
        );
        await updateBot(b.id, {
          ...edit,
          files: loaded() ? changed : undefined,
        });
        dialog?.close();
      } else {
        const id = await createBot(edit);
        dialog?.close();
        navigate(paths.b(id)());
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const b = bot();
    if (!b) return;
    const open = session() && location.pathname === paths.s(session()!.id)();
    setBusy(true);
    try {
      await deleteBot(b.id);
      dialog?.close();
      if (open) navigate(paths(), { replace: true });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const title = () => {
    const b = bot();
    if (!b) return 'New bot';
    return confirming() ? `Delete ${b.name}?` : `Edit ${b.name}`;
  };

  return (
    <Dialog
      ref={(el) => (dialog = el)}
      title={title()}
      onOpen={fill}
      class={confirming() ? undefined : 'md:w-[36rem]'}
      footer={
        <Show
          when={!confirming()}
          fallback={
            <>
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="danger" loading={busy()} onClick={remove}>
                Delete
              </Button>
            </>
          }
        >
          <Show when={bot()}>
            <Button class="mr-auto" onClick={() => setConfirming(true)}>
              Delete bot
            </Button>
          </Show>
          <Button
            variant="primary"
            type="submit"
            form="bot-dialog"
            loading={busy()}
            disabled={!name().trim() || !workspace().trim()}
          >
            {bot() ? 'Save' : 'Create'}
          </Button>
        </Show>
      }
    >
      <Show
        when={!confirming()}
        fallback={
          <div class="flex flex-col gap-3 p-4">
            <Show when={error()}>
              <Alert>{error()}</Alert>
            </Show>
            <p>
              Its session and the sessions in its workspace are archived, and
              their terminals close. Sessions it started in projects stay, and
              are yours.
            </p>
            <p class="text-muted">
              Its files stay in{' '}
              <bdi class="font-mono text-meta break-all">{bot()?.homePath}</bdi>
              .
            </p>
          </div>
        }
      >
        {/* Outside the scroller, so it shows however far down you are. */}
        <Show when={error()}>
          <div class="shrink-0 border-b border-line p-3">
            <Alert>{error()}</Alert>
          </div>
        </Show>
        <form
          id="bot-dialog"
          class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 *:shrink-0"
          onSubmit={save}
        >
          <Field
            label="Name"
            value={name()}
            onInput={setName}
            placeholder="Ada"
            required
            autofocus={!bot() && !isTouch()}
          />
          <fieldset class="flex flex-col gap-1.5">
            <legend class="mb-1.5 text-meta font-medium">Color</legend>
            <div class="flex flex-wrap gap-2" role="radiogroup">
              <For each={BOT_COLORS}>
                {(c) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={color() === c ? 'true' : 'false'}
                    aria-label={c}
                    title={c}
                    class={[
                      'grid size-7 place-items-center rounded-full text-paper ring-offset-2 ring-offset-panel transition-shadow touch:size-11 [&_svg]:size-4',
                      BOT_SWATCH[c],
                      color() === c
                        ? 'ring-2 ring-fg'
                        : 'hover:ring-2 hover:ring-line-strong',
                    ]}
                    onClick={() => setColor(c)}
                  >
                    <Show when={color() === c}>
                      <DrawnCheckIcon />
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </fieldset>
          <Field
            label="Workspace"
            value={workspace()}
            onInput={setWorkspace}
            placeholder="~/Repos"
            hint="The folder that holds your projects. Sessions it starts outside a project run here."
            required
          />
          <Field
            label="Home"
            value={home()}
            onInput={setHome}
            placeholder="In Bica's data folder"
            hint="Where its instructions and memory files live, such as a folder in your notes vault."
          />
          <Show when={bot()}>
            <For each={FILE_KEYS}>
              {(k) => (
                <div class="flex flex-col gap-1.5">
                  <label class="text-meta font-medium" for={`bot-file-${k}`}>
                    {FILE_LABELS[k]}{' '}
                    <span class="font-normal text-muted">{BOT_FILES[k]}</span>
                  </label>
                  <TextArea
                    id={`bot-file-${k}`}
                    aria-describedby={`bot-file-${k}-hint`}
                    framed
                    class="max-h-80 min-h-20 px-2.5 py-2"
                    value={files()[k]}
                    disabled={!loaded()}
                    placeholder={loaded() ? 'Empty' : 'Reading…'}
                    onInput={(e) =>
                      setFiles({ ...files(), [k]: e.currentTarget.value })
                    }
                  />
                  <p id={`bot-file-${k}-hint`} class="text-meta text-muted">
                    {FILE_HINTS[k]}
                  </p>
                </div>
              )}
            </For>
          </Show>
        </form>
      </Show>
    </Dialog>
  );
}
