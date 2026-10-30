import type { JSX } from '@solidjs/web';
import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';

import { Meter } from '../voice/CallBar';
import { createDictation } from '../voice/dictation';
import { imageUrl, toPromptImage } from './images';
import type { PromptImage } from '@bica/shared/protocol';
import { imageMarker, imageMarkers } from '@bica/shared/images';
import Alert from '../ui/Alert';
import { createDropZone } from '../ui/DropZone';
import { Button, IconButton } from '../ui/Button';
import {
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  ImageIcon,
  MicIcon,
  QueueIcon,
  StopIcon,
} from '../ui/icons';
import { Spinner } from '../ui/Spinner';
import Chevron from '../ui/Chevron';
import Kbd from '../ui/Kbd';
import { OptionList, optionClass } from '../ui/Option';
import { Popover } from '../ui/Popover';
import { errorText } from '../ui/errors';

// `ref` is the n of its `[Image #n]` marker. While it's still being read,
// `data` is empty and `preview` shows the file as picked.
type Attached = PromptImage & { id: number; ref: number; preview?: string };
let nextId = 0;
let nextMenu = 0;

// Prompts sent from this browser, oldest first, shared by every composer.
const HISTORY_KEY = 'prompt-history';
function readHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function remember(prompt: string) {
  // Huge prompts would fill localStorage's few megabytes.
  if (prompt.length > 20_000) return;
  const list = readHistory().filter((p) => p !== prompt);
  list.push(prompt);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-200)));
  } catch {}
}

// What's typed, kept per session so it neither follows you to the next one
// nor dies with a reload. Images stay in memory, since they're too big.
type Draft = { text: string; pastes: [number, string][] };
function draftKey(key: string) {
  return `draft:${key}`;
}
function readDraft(key: string): Draft {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(key)) ?? 'null');
    if (draft) return draft;
  } catch {}
  return { text: '', pastes: [] };
}
function writeDraft(key: string, draft: Draft) {
  try {
    if (draft.text.trim())
      localStorage.setItem(draftKey(key), JSON.stringify(draft));
    else localStorage.removeItem(draftKey(key));
  } catch {}
}
const draftImages = new Map<string, Attached[]>();

const foldedPaste = /\[Pasted text #(\d+) · \d+ lines\]/g;

export interface ComposerApi {
  // Puts a prompt taken back from the queue into the box, after what's typed.
  restore: (prompt: string, images: PromptImage[]) => void;
  problem: (message: string) => void;
  // Sends what's typed the `alternate` way, for a button in `actions`.
  sendAlternate: () => void;
  // Keeps what's typed as a normal draft when the hold ends, e.g. on Cancel.
  releaseHold: () => void;
}

export default function Composer(props: {
  // steer: join the current run after its step, instead of queuing.
  // alternate: sent through `sendAlternate` instead of the send button.
  onSend: (
    prompt: string,
    images: PromptImage[],
    steer: boolean,
    alternate: boolean,
  ) => Promise<unknown>;
  // Words on the send button, when sending does more than send.
  sendLabel?: string;
  // Saved text the box edits, e.g. a prompt held for tonight: the box starts
  // from it, edits go to `onHoldEdit` as you type, Enter adds a line instead
  // of sending, and images are off. When it ends unedited, the box empties.
  hold?: string | null;
  // `key` is the draft's, since a late edit can land after moving on.
  onHoldEdit?: (key: string, text: string) => Promise<unknown>;
  // Where the draft is kept, e.g. the session id.
  draft: string;
  placeholder?: string;
  // Next to attach, e.g. the model picker.
  controls?: JSX.Element;
  // Just left of stop and send, e.g. the voice call button.
  actions?: JSX.Element;
  // Above the text, inside the box, e.g. the queued prompts.
  top?: JSX.Element;
  // A run is working: sending steers, ⌘Enter queues, and a stop button shows.
  busy?: boolean;
  onStop?: () => Promise<unknown>;
  ref?: (api: ComposerApi) => void;
}) {
  const [images, setImages] = createSignal<Attached[]>([]);
  const [problem, setProblem] = createSignal('');
  const [stopping, setStopping] = createSignal(false);
  // Prompts with images still on their way to the server, slow on a phone.
  const [uploading, setUploading] = createSignal(0, { name: 'uploading' });
  const reading = new Set<Promise<unknown>>();
  // Whether there's anything to send: the send button wakes up when there is.
  const [typed, setTyped] = createSignal(false, { name: 'composerTyped' });
  const empty = () => !typed() && !images().length;
  // Working with something typed: send splits into send now and a menu.
  const split = () => !!props.busy && !empty();
  // Working with nothing typed: the send button stops instead.
  const stopHere = () => !!props.busy && !!props.onStop && empty();
  let picker!: HTMLInputElement;
  let textarea!: HTMLTextAreaElement;
  let sendMenu: HTMLDivElement | undefined;
  const sendMenuId = `send-menu-${++nextMenu}`;
  // Long pastes show as a short marker and go out in full.
  const pastes = new Map<number, string>();
  const unfold = (text: string) =>
    text.replace(foldedPaste, (marker, n) => pastes.get(Number(n)) ?? marker);
  // Where ↑/↓ is in the history, and what was typed before; null while typing.
  let browsing: { list: string[]; index: number; draft: string } | null = null;
  let lastEscape = 0;
  // What a held ↑/↓ is doing, so holding never crosses from lines into history.
  let hold: 'caret' | 'history' = 'caret';

  // The caret lands where the same key goes on through the history.
  const showText = (text: string, caret: 'start' | 'end') => {
    textarea.value = text;
    const at = caret === 'start' ? 0 : text.length;
    textarea.setSelectionRange(at, at);
    save();
  };

  // The hold the box shows now; its text unedited is no draft.
  let held: string | null = null;
  let keepOnRelease = false;
  let edit: { key: string; text: string } | undefined;
  let editTimer: ReturnType<typeof setTimeout> | undefined;
  const flushEdit = () => {
    clearTimeout(editTimer);
    const pending = edit;
    edit = undefined;
    if (pending)
      props
        .onHoldEdit?.(pending.key, pending.text)
        .catch((error) => setProblem(errorText(error)));
  };
  onCleanup(flushEdit);

  const save = (key = props.draft) => {
    setTyped(!!textarea.value.trim());
    writeDraft(key, {
      text: textarea.value === held ? '' : textarea.value,
      pastes: [...pastes],
    });
    const text = unfold(textarea.value.trim());
    if (held === null || !text || text === held) return;
    edit = { key, text };
    clearTimeout(editTimer);
    editTimer = setTimeout(flushEdit, 600);
  };

  createEffect(
    () => ({ key: props.draft, hold: props.hold ?? null }),
    (now, before) => {
      if (before?.key === now.key) {
        if (now.hold !== null) {
          if (!textarea.value.trim()) textarea.value = now.hold;
        } else if (!keepOnRelease && textarea.value === before.hold)
          textarea.value = '';
        keepOnRelease = false;
        held = now.hold;
        save(now.key);
        return;
      }
      if (before) {
        save(before.key);
        flushEdit();
        draftImages.set(before.key, untrack(images));
      }
      held = now.hold;
      keepOnRelease = false;
      const draft = readDraft(now.key);
      textarea.value = draft.text || (now.hold ?? '');
      setTyped(!!textarea.value.trim());
      pastes.clear();
      for (const [n, text] of draft.pastes) pastes.set(n, text);
      browsing = null;
      setImages(draftImages.get(now.key) ?? []);
      draftImages.delete(now.key);
      setProblem('');
    },
  );

  const api: ComposerApi = {
    restore(prompt, restored) {
      // Numbered past what the box holds already, markers and all.
      const base = nextRef() - 1;
      const refs = new Set(restored.flatMap((i) => i.ref ?? []));
      if (base)
        prompt = prompt.replace(imageMarkers, (m, n) =>
          refs.has(Number(n)) ? imageMarker(Number(n) + base) : m,
        );
      if (prompt)
        textarea.value = textarea.value.trim()
          ? `${textarea.value.trimEnd()}\n\n${prompt}`
          : prompt;
      let next = base + Math.max(0, ...refs);
      if (restored.length)
        setImages((list) => [
          ...list,
          ...restored.map((i) => ({
            ...i,
            id: ++nextId,
            ref: i.ref === undefined ? ++next : i.ref + base,
          })),
        ]);
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      save();
    },
    problem: setProblem,
    sendAlternate: () => void send(false, true),
    releaseHold: () => (keepOnRelease = true),
  };

  const stop = async () => {
    if (!props.onStop || stopping()) return;
    setStopping(true);
    setProblem('');
    try {
      await props.onStop();
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setStopping(false);
    }
  };

  // Phones only: their keyboards' own dictation is the weak spot.
  const touch = matchMedia('(pointer: coarse)').matches;
  const dictation = createDictation((text) => {
    const before = textarea.value.slice(0, textarea.selectionStart);
    const space = before && !/\s$/.test(before) ? ' ' : '';
    textarea.setRangeText(
      space + text,
      textarea.selectionStart,
      textarea.selectionEnd,
      'end',
    );
    save();
  });
  const dictating = () => dictation.phase() !== 'idle';
  const dictate = () => {
    setProblem('');
    dictation.toggle()?.catch((error) => setProblem(errorText(error)));
  };

  const drop = createDropZone({
    accept: 'image/',
    noun: 'image',
    onFiles: (files) => attach(files),
  });

  // One past the highest number in use, so a marker never means two images.
  const nextRef = () =>
    1 +
    Math.max(
      0,
      ...untrack(images).map((i) => i.ref),
      ...[...textarea.value.matchAll(imageMarkers)].map((m) => Number(m[1])),
    );

  // At the caret, spaced from the words around it.
  const insert = (text: string) => {
    const { selectionStart: from, selectionEnd: to, value } = textarea;
    const before = from && !/\s$/.test(value.slice(0, from)) ? ' ' : '';
    const after = /^\s/.test(value.slice(to)) ? '' : ' ';
    const full = before + text + after;
    // execCommand keeps it in the undo history; setRangeText doesn't.
    if (
      document.activeElement !== textarea ||
      !document.execCommand('insertText', false, full)
    )
      textarea.setRangeText(full, from, to, 'end');
    save();
  };

  // A picked image's marker goes with it, and the space before it.
  const unmark = (ref: number) => {
    const value = textarea.value.replace(
      new RegExp(` ?\\[Image #${ref}\\]`),
      '',
    );
    if (value !== textarea.value) {
      textarea.value = value;
      save();
    }
  };

  // Changes it in whichever draft holds it now, since reading can outlast
  // a switch to another session.
  const update = (id: number, change: (i: Attached) => Attached | null) => {
    const apply = (list: Attached[]) =>
      list.flatMap((i) => (i.id === id ? (change(i) ?? []) : [i]));
    setImages(apply);
    for (const [key, list] of draftImages) draftImages.set(key, apply(list));
  };

  // Each image shows at once, from the file, while it's read and shrunk:
  // a photo on a phone takes a few seconds.
  const attach = (files: File[]) => {
    setProblem('');
    if (held !== null) return setProblem('This prompt takes text only.');
    let ref = nextRef();
    const slots = files.map((file) => ({
      file,
      image: {
        id: ++nextId,
        ref: ref++,
        mimeType: file.type,
        data: '',
        preview: URL.createObjectURL(file),
      } satisfies Attached,
    }));
    insert(slots.map((s) => imageMarker(s.image.ref)).join(' '));
    setImages((list) => [...list, ...slots.map((s) => s.image)]);
    for (const { file, image } of slots) {
      const done = toPromptImage(file)
        .then((read) => update(image.id, (i) => ({ ...i, ...read })))
        .catch((error) => {
          update(image.id, () => null);
          unmark(image.ref);
          setProblem(errorText(error));
        })
        .finally(() => {
          URL.revokeObjectURL(image.preview);
          reading.delete(done);
        });
      reading.add(done);
    }
  };

  const send = async (steer: boolean, alternate = false) => {
    const key = props.draft;
    if (reading.size) {
      setUploading((n) => n + 1);
      await Promise.all(reading);
      setUploading((n) => n - 1);
      if (props.draft !== key) return;
    }
    const typed = textarea.value.trim();
    const sentPastes = [...pastes];
    const prompt = unfold(typed);
    const sent = images();
    if (!prompt && !sent.length) return;
    // Sending a hold sends its latest text, so no edit is left to save.
    clearTimeout(editTimer);
    edit = undefined;
    // Cleared up front so typing can go on; put back if it fails.
    textarea.value = '';
    save();
    browsing = null;
    setImages([]);
    setProblem('');
    if (sent.length) setUploading((n) => n + 1);
    try {
      await props.onSend(
        prompt,
        sent.map(({ mimeType, data, ref }) => ({ mimeType, data, ref })),
        steer,
        alternate,
      );
      if (prompt) remember(prompt);
      if (props.draft === key && !textarea.value.includes('[Pasted text #'))
        pastes.clear();
    } catch (error) {
      console.error(error);
      if (props.draft !== key) {
        // Moved on to another session meanwhile: back into its own draft.
        if (!readDraft(key).text)
          writeDraft(key, { text: typed, pastes: sentPastes });
        return;
      }
      if (!textarea.value) textarea.value = typed;
      save();
      setImages((list) => [...sent, ...list]);
    } finally {
      if (sent.length) setUploading((n) => n - 1);
    }
  };

  return (
    // A tray behind the card, after affectUI's Chat Composer: queued prompts
    // and warnings sit on it, above the box. It reaches 4px past the card,
    // so the card stays where it was. It only shows with something on it:
    // everything that turns up there enters with `appear`.
    <div class="-m-1 flex flex-col rounded-tray p-1 transition-colors duration-200 has-[[data-tray]_.appear]:bg-panel">
      <div data-tray class="flex flex-col px-1">
        {props.top}
      </div>
      <form
        ref={() => props.ref?.(api)}
        {...drop.handlers}
        class="@container/composer relative flex flex-col gap-1 rounded-sheet border border-line bg-surface py-2.5 pr-2.5 pl-4 shadow-raised transition-[border-color,box-shadow] duration-200 ease-out focus-within:border-line-strong focus-within:ring-3 focus-within:ring-accent/12"
        onSubmit={(e) => {
          e.preventDefault();
          void send(!!props.busy);
        }}
      >
        <Show when={images().length}>
          <div class="flex flex-wrap gap-2 pt-1.5">
            <For each={images()} keyed={(i) => i.id}>
              {(image) => (
                <div class="group/img appear relative">
                  <img
                    src={image().data ? imageUrl(image()) : image().preview}
                    alt=""
                    class={[
                      'size-14 rounded-lg border border-line bg-panel object-cover transition-opacity duration-200',
                      !image().data && 'opacity-50',
                    ]}
                  />
                  <Show when={!image().data}>
                    <span class="absolute inset-0 grid place-items-center text-fg">
                      <Spinner />
                    </span>
                  </Show>
                  <span class="absolute bottom-0.5 left-0.5 rounded-sm bg-bg/80 px-1 text-meta text-fg tabular-nums">
                    #{image().ref}
                  </span>
                  <button
                    type="button"
                    class="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border border-line bg-surface text-muted shadow-thumb transition-[color,scale,opacity] duration-150 ease-out hover:text-fg motion-safe:active:scale-90 touch:size-7 [&_svg]:size-3"
                    title="Remove image"
                    onClick={() => {
                      setImages((list) =>
                        list.filter((i) => i.id !== image().id),
                      );
                      unmark(image().ref);
                    }}
                  >
                    <CloseIcon />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
        <textarea
          ref={(el) => (textarea = el)}
          name="prompt"
          rows="1"
          readonly={dictating()}
          class={[
            'max-h-[40vh] min-h-8 resize-none bg-transparent py-1 text-read outline-none transition-opacity duration-200 [field-sizing:content] placeholder:text-muted',
            dictating() && 'opacity-40',
          ]}
          placeholder={
            props.busy
              ? 'Message the agent…'
              : (props.placeholder ?? 'Ask anything…')
          }
          onInput={() => {
            browsing = null;
            save();
          }}
          onPaste={(e) => {
            // Screenshots and copied images arrive as files.
            const files = [...(e.clipboardData?.items ?? [])].flatMap(
              (item) => {
                const file =
                  item.kind === 'file' && item.type.startsWith('image/')
                    ? item.getAsFile()
                    : null;
                return file ? [file] : [];
              },
            );
            if (files.length) {
              e.preventDefault();
              attach(files);
              return;
            }
            const text = e.clipboardData?.getData('text/plain') ?? '';
            const lines = text.split('\n').length;
            if (lines <= 15 && text.length <= 2000) return;
            e.preventDefault();
            const n = pastes.size + 1;
            pastes.set(n, text);
            const marker = `[Pasted text #${n} · ${lines} lines]`;
            // execCommand keeps the paste in the undo history; setRangeText doesn't.
            if (!document.execCommand('insertText', false, marker))
              textarea.setRangeText(
                marker,
                textarea.selectionStart,
                textarea.selectionEnd,
                'end',
              );
            save();
          }}
          onKeyDown={(e) => {
            if (e.isComposing) return;
            if (e.key === 'Escape' && props.busy && props.onStop) {
              // Twice, so closing something with Esc can't stop a run by accident.
              if (e.timeStamp - lastEscape < 500) {
                lastEscape = 0;
                void stop();
              } else lastEscape = e.timeStamp;
              return;
            }
            const box = e.currentTarget;
            const caret = box.selectionStart;
            const noSelection = caret === box.selectionEnd;
            const plain = !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
            // A marker goes in one Backspace, and its image with it, as in Codex.
            if (e.key === 'Backspace' && plain && noSelection) {
              const marker = /\[Image #(\d+)\]$/.exec(
                box.value.slice(0, caret),
              );
              const image =
                marker && images().find((i) => i.ref === Number(marker[1]));
              if (image) {
                e.preventDefault();
                box.setSelectionRange(caret - marker[0].length, caret);
                if (!document.execCommand('delete'))
                  box.setRangeText('', box.selectionStart, caret, 'end');
                setImages((list) => list.filter((i) => i.id !== image.id));
                save();
                return;
              }
            }
            // History only from the very start or end, so ↑/↓ elsewhere moves lines.
            const arrow = e.key === 'ArrowUp' || e.key === 'ArrowDown';
            const canSwitch = !e.repeat || hold === 'history';
            if (arrow) hold = 'caret';
            if (
              e.key === 'ArrowUp' &&
              plain &&
              noSelection &&
              canSwitch &&
              caret === 0
            ) {
              browsing ??= {
                list: readHistory(),
                index: -1,
                draft: box.value,
              };
              const index =
                (browsing.index === -1
                  ? browsing.list.length
                  : browsing.index) - 1;
              if (index < 0) return;
              e.preventDefault();
              hold = 'history';
              browsing.index = index;
              showText(browsing.list[index]!, 'start');
              return;
            }
            if (
              e.key === 'ArrowDown' &&
              plain &&
              noSelection &&
              browsing &&
              canSwitch &&
              caret === box.value.length
            ) {
              e.preventDefault();
              hold = 'history';
              const index = browsing.index + 1;
              if (index >= browsing.list.length) {
                showText(browsing.draft, 'end');
                browsing = null;
              } else {
                browsing.index = index;
                showText(browsing.list[index]!, 'end');
              }
              return;
            }
            // Steering is the default while it works, as in Pi, Codex, and
            // Cursor: a new prompt is nearly always about the work at hand.
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send(false);
              return;
            }
            // On touch keyboards Enter is the only way to add a newline.
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              held === null &&
              !matchMedia('(pointer: coarse)').matches
            ) {
              e.preventDefault();
              void send(!!props.busy);
            }
          }}
        />
        <Show when={problem()}>
          <Alert>{problem()}</Alert>
        </Show>
        <div class="-ml-1.5 flex items-center gap-0.5">
          <div class={dictating() ? 'hidden' : 'contents'}>
            <IconButton
              size="md"
              title="Attach images"
              hidden={props.hold != null}
              onClick={() => picker.click()}
            >
              <ImageIcon />
            </IconButton>
            <input
              ref={(el) => (picker = el)}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.currentTarget.files ?? [])];
                // Cleared so picking the same file again still fires.
                e.currentTarget.value = '';
                attach(files);
              }}
            />
            {props.controls}
          </div>
          <Show when={dictating()}>
            <div class="appear flex min-w-0 items-center gap-2.5 pl-1.5">
              <Show
                when={dictation.phase() === 'recording'}
                fallback={<span class="shimmer text-ui">Writing it out…</span>}
              >
                <IconButton
                  size="md"
                  round
                  title="Discard the recording"
                  onClick={dictation.cancel}
                >
                  <CloseIcon />
                </IconButton>
                <Meter
                  who="you"
                  still={false}
                  working={false}
                  level={dictation.level}
                />
                <Elapsed since={dictation.started()} />
              </Show>
            </div>
          </Show>
          <div class="ml-auto" />
          <IconButton
            size="md"
            round
            hidden={!touch}
            variant={dictation.phase() === 'recording' ? 'primary' : undefined}
            title={
              dictation.phase() === 'recording'
                ? 'Done, write it out'
                : 'Dictate'
            }
            aria-pressed={dictation.phase() === 'recording' ? 'true' : 'false'}
            loading={dictation.phase() === 'transcribing'}
            onClick={dictate}
          >
            <Show
              when={dictation.phase() === 'recording'}
              fallback={<MicIcon />}
            >
              <CheckIcon />
            </Show>
          </IconButton>
          <div class={dictating() ? 'hidden' : 'contents'}>{props.actions}</div>
          <Show when={props.sendLabel}>
            {(label) => (
              <Button
                // On a narrow composer only the arrow shows; the label stays
                // for screen readers and the placeholder says what it does.
                class={[
                  'ml-1 pr-2.5 pl-3 @max-sm/composer:pl-2.5 [&_svg]:size-3.5 [&_svg]:stroke-[2.5]',
                  empty() && 'opacity-30',
                ]}
                variant="primary"
                size="md"
                round
                type="submit"
                title={props.busy ? `${label()}, after this run` : label()}
                loading={uploading() > 0}
                aria-disabled={empty() ? 'true' : undefined}
              >
                <span class="@max-sm/composer:sr-only">{label()}</span>
                <Show when={props.busy && !empty()} fallback={<ArrowUpIcon />}>
                  <QueueIcon />
                </Show>
              </Button>
            )}
          </Show>
          {/* One control in the send spot. Idle: send. Working with nothing
            typed: stop. Working with something typed: a split button, send
            now, and under the chevron Queue and Stop, the only way to either
            on a phone. The buttons stay mounted and only their icon and
            width change, so switching never pops a new button in. */}
          {/* One shape that clips both buttons, so the chevron widens it
            from a circle into a pill instead of popping in beside it. */}
          <div
            hidden={!!props.sendLabel || dictating()}
            // Faded while there's nothing to send, solid once there is. Only
            // this shape is round: a round button inside would leave a notch
            // while the chevron shrinks.
            class={[
              'ml-1 flex overflow-hidden rounded-full transition-[opacity,scale] duration-150 ease-out',
              empty() && !stopHere() && 'opacity-30 motion-safe:scale-90',
            ]}
            style={{ 'anchor-name': `--${sendMenuId}` }}
          >
            <IconButton
              class="rounded-none!"
              variant="primary"
              size="md"
              type={stopHere() ? 'button' : 'submit'}
              title={
                stopHere()
                  ? 'Stop (Esc twice)'
                  : split()
                    ? 'Send now, into this run'
                    : 'Send'
              }
              loading={stopHere() ? stopping() : uploading() > 0}
              aria-disabled={empty() && !stopHere() ? 'true' : undefined}
              onClick={() => stopHere() && void stop()}
            >
              {/* Both icons stay, stacked, and crossfade. */}
              <span class="grid place-items-center *:col-start-1 *:row-start-1 *:transition-[opacity,scale] *:duration-200 *:ease-out">
                <span
                  class={[
                    '[&_svg]:size-3',
                    stopHere()
                      ? 'opacity-100'
                      : 'opacity-0 motion-safe:scale-50',
                  ]}
                >
                  <StopIcon />
                </span>
                <span
                  class={[
                    '[&_svg]:size-3.5 [&_svg]:stroke-[2.5]',
                    stopHere()
                      ? 'opacity-0 motion-safe:scale-50'
                      : 'opacity-100',
                  ]}
                >
                  <ArrowUpIcon />
                </span>
              </span>
            </IconButton>
            <IconButton
              class={[
                'relative overflow-hidden rounded-none! transition-[width] duration-200 ease-out',
                'before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-bg/25',
                split() ? 'w-6! touch:w-8!' : 'w-0!',
              ]}
              variant="primary"
              size="md"
              title="More ways to send"
              aria-haspopup="menu"
              aria-hidden={split() ? undefined : 'true'}
              tabindex={split() ? undefined : -1}
              popovertarget={sendMenuId}
            >
              <Chevron
                class={`-rotate-90 transition-opacity duration-200 [&_svg]:size-3 ${split() ? 'opacity-100' : 'opacity-0'}`}
              />
            </IconButton>
          </div>
          <Popover
            ref={(el) => (sendMenu = el)}
            id={sendMenuId}
            label="More ways to send"
            place="top-end"
            width="sm"
          >
            <OptionList>
              <button
                type="button"
                class={optionClass}
                onClick={() => {
                  sendMenu?.hidePopover();
                  void send(false);
                }}
              >
                <QueueIcon />
                <span class="flex-1">
                  Queue
                  <span class="block text-meta text-muted">
                    Sends when the run ends
                  </span>
                </span>
                <Kbd class="-mr-1 touch:hidden">⌘Enter</Kbd>
              </button>
              <Show when={props.onStop}>
                <button
                  type="button"
                  class={optionClass}
                  onClick={() => {
                    sendMenu?.hidePopover();
                    void stop();
                  }}
                >
                  <span class="grid size-4 place-items-center [&_svg]:size-2.5">
                    <StopIcon />
                  </span>
                  <span class="flex-1">
                    Stop
                    <span class="block text-meta text-muted">
                      Ends the run now
                    </span>
                  </span>
                  <Kbd class="-mr-1 touch:hidden">Esc Esc</Kbd>
                </button>
              </Show>
            </OptionList>
          </Popover>
        </div>
        <drop.Overlay />
      </form>
    </div>
  );
}

// A recording's length, m:ss, ticking each second.
function Elapsed(props: { since: number }) {
  const [now, setNow] = createSignal(Date.now(), { name: 'dictationNow' });
  const timer = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(timer));
  const seconds = () => Math.max(0, Math.floor((now() - props.since) / 1000));
  return (
    <span class="text-ui text-muted tabular-nums">
      {Math.floor(seconds() / 60)}:{String(seconds() % 60).padStart(2, '0')}
    </span>
  );
}
