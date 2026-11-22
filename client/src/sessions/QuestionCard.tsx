import { For, Show, createSignal, onSettled } from 'solid-js';

import type { Question } from '@bica/shared/transcript';
import {
  RequestFooter,
  RequestHeader,
  RequestSheet,
  RequestTray,
  ResolvedRow,
} from '../requests/RequestCard';
import { Button } from '../ui/Button';
import { CheckMark } from '../ui/CheckMark';
import Input from '../ui/Input';
import Kbd from '../ui/Kbd';
import { QuestionIcon } from '../ui/icons';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

/**
 * The agent's questions (the `ask` tool), a request card after affectUI's
 * Decision Inbox: options with number keys, ⌘↵ to send.
 * While the session waits, each question takes picks, a written answer, or
 * both, and any can be skipped. Send goes back as a normal prompt; typing in
 * the composer answers too. Once answered, the card glides down into one
 * row, which opens to the questions and the answers.
 */
export default function QuestionCard(props: {
  questions: Question[];
  open: boolean;
  // The prompt that answered, from the card or the composer.
  answer?: string;
  onAnswer: (text: string) => Promise<unknown>;
}) {
  // Per question: picked option labels, and what was written.
  const [picks, setPicks] = createSignal<string[][]>([], { name: 'askPicks' });
  const [notes, setNotes] = createSignal<string[]>([], { name: 'askNotes' });
  const [sending, setSending] = createSignal(false, { name: 'askSending' });
  // The question the number keys pick for: the one with focus, or the first open one.
  const [current, setCurrent] = createSignal<number>(-1, {
    name: 'askCurrent',
  });

  const answered = (i: number) =>
    (picks()[i] ?? []).length > 0 || !!notes()[i]?.trim();
  const skipped = () => props.questions.filter((_, i) => !answered(i)).length;
  const ready = () => skipped() < props.questions.length && !sending();

  const send = async () => {
    if (!ready()) return;
    setSending(true);
    try {
      await props.onAnswer(answerText(props.questions, picks(), notes()));
    } catch {
      setSending(false);
    }
  };

  // Tapping a picked option again takes it back, so a question can be left blank.
  const pick = (q: number, label: string) => {
    const current = picks()[q] ?? [];
    const next = current.includes(label)
      ? current.filter((l) => l !== label)
      : props.questions[q]!.multiSelect
        ? [...current, label]
        : [label];
    setPicks(
      props.questions.map((_, i) => (i === q ? next : (picks()[i] ?? []))),
    );
  };

  const write = (q: number, text: string) =>
    setNotes(
      props.questions.map((_, i) => (i === q ? text : (notes()[i] ?? ''))),
    );

  const target = () => {
    const c = current();
    if (c >= 0) return c;
    const open = props.questions.findIndex((_, i) => !answered(i));
    return open >= 0 ? open : 0;
  };

  let root!: HTMLDivElement;
  // Number keys pick, ⌘↵ sends: inside the card, or with nothing focused
  // (the page itself), so a glance and a key is enough.
  onSettled(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!props.open || sending() || e.defaultPrevented || e.isComposing)
        return;
      const inside = root.contains(document.activeElement);
      if (!inside && document.activeElement !== document.body) return;
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void send();
        return;
      }
      const typing = (document.activeElement as Element | null)?.matches(
        'input, textarea, [contenteditable]',
      );
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      const q = props.questions[target()];
      if (!q || !Number.isInteger(n) || n < 1 || n > q.options.length) return;
      e.preventDefault();
      pick(target(), q.options[n - 1]!.label);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const count = () => props.questions.length;
  return (
    <RequestTray
      open={props.open}
      label={props.open ? 'The agent asks' : 'Asked'}
      busy={sending()}
      resolved={(seen) => (
        <Resolved
          questions={props.questions}
          answer={props.answer}
          seen={seen}
        />
      )}
    >
      <div ref={(el) => (root = el)} class="contents">
        <RequestHeader icon={<QuestionIcon />} title="The agent asks">
          <span>
            · {count()} {count() === 1 ? 'question' : 'questions'}
          </span>
        </RequestHeader>
        <RequestSheet class="gap-5">
          <For each={props.questions} keyed={false}>
            {(q, i) => (
              <fieldset
                class="flex min-w-0 flex-col gap-2"
                disabled={sending()}
                onFocusIn={() => setCurrent(i)}
              >
                <legend class="contents">
                  <span class="flex items-baseline gap-2">
                    <Show when={q().header}>
                      <span class="shrink-0 rounded-sm bg-active px-1.5 text-meta font-medium text-muted">
                        {q().header}
                      </span>
                    </Show>
                    <Show when={q().multiSelect}>
                      <span class="text-meta text-muted">Pick any</span>
                    </Show>
                  </span>
                  <span class="mt-1.5 block text-pretty font-medium">
                    {q().question}
                  </span>
                </legend>
                <div class="flex flex-col gap-1">
                  <For each={q().options} keyed={false}>
                    {(option, n) => {
                      const picked = () =>
                        (picks()[i] ?? []).includes(option().label);
                      return (
                        <button
                          type="button"
                          aria-pressed={picked() ? 'true' : 'false'}
                          aria-keyshortcuts={n < 9 ? String(n + 1) : undefined}
                          class={[
                            'group/opt flex min-h-10 items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-[background-color,border-color,scale] duration-150 ease-out disabled:opacity-60 motion-safe:active:scale-99 touch:min-h-11',
                            picked()
                              ? 'border-accent/60 bg-accent/8'
                              : 'border-line not-disabled:hover:border-line-strong not-disabled:hover:bg-hover',
                          ]}
                          onClick={() => pick(i, option().label)}
                        >
                          <CheckMark radio={!q().multiSelect} on={picked()} />
                          <span class="flex min-w-0 flex-1 flex-col">
                            <span class="wrap-anywhere">{option().label}</span>
                            <Show when={option().description}>
                              <span class="text-meta text-pretty text-muted">
                                {option().description}
                              </span>
                            </Show>
                          </span>
                          <Show when={n < 9}>
                            <Kbd
                              class={[
                                'transition-opacity',
                                target() !== i && 'opacity-0',
                              ]}
                            >
                              {n + 1}
                            </Kbd>
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                  <Input
                    class="h-10 rounded-lg px-2.5 touch:h-11"
                    placeholder="Your own answer, or a note…"
                    aria-label={`Your answer to: ${q().question}`}
                    value={notes()[i] ?? ''}
                    onInput={(e) => write(i, e.currentTarget.value)}
                  />
                </div>
              </fieldset>
            )}
          </For>
        </RequestSheet>
        <RequestFooter>
          <span class="mr-auto text-meta text-muted">
            {skipped() && count() > 1 && ready()
              ? `${skipped()} left blank, sent as skipped`
              : 'Skip any you don’t want to answer.'}
          </span>
          <Button
            variant="soft"
            disabled={!ready() && !sending()}
            loading={sending()}
            aria-keyshortcuts={MAC ? 'Meta+Enter' : 'Control+Enter'}
            class="pr-1.5"
            onClick={send}
          >
            {skipped() && count() > 1 ? `Send, skip ${skipped()}` : 'Send'}
            <Kbd class="bg-bg/60">{MAC ? '⌘↵' : 'Ctrl↵'}</Kbd>
          </Button>
        </RequestFooter>
      </div>
    </RequestTray>
  );
}

/** The answered card, folded to one row that opens to the questions and answers. */
function Resolved(props: {
  questions: Question[];
  answer?: string;
  seen: boolean;
}) {
  const answers = () => answersOf(props.questions, props.answer);
  const first = () => props.questions[0]?.question ?? '';
  const more = () => props.questions.length - 1;
  return (
    <ResolvedRow
      seen={props.seen}
      outcome={props.answer === undefined ? 'closed' : 'done'}
      summary={
        <>
          <span class="text-muted">Asked </span>
          {first()}
          <Show when={more() > 0}>
            <span class="text-muted"> · +{more()} more</span>
          </Show>
        </>
      }
    >
      <For each={props.questions} keyed={false}>
        {(q, i) => (
          <div class="flex flex-col gap-1">
            <div class="text-meta font-medium text-muted">{q().header}</div>
            <div class="text-pretty text-muted">{q().question}</div>
            <Show
              when={answers()}
              fallback={
                <div class="text-meta text-muted">
                  {q()
                    .options.map((o) => o.label)
                    .join(' · ')}
                </div>
              }
            >
              {(list) => (
                <Show
                  when={list()[i] !== SKIPPED && list()[i]}
                  fallback={<div class="text-muted italic">Skipped</div>}
                >
                  {(answer) => (
                    <div class="whitespace-pre-wrap wrap-anywhere">
                      {answer()}
                    </div>
                  )}
                </Show>
              )}
            </Show>
          </div>
        )}
      </For>
      <Show when={!answers() && props.answer}>
        {(text) => (
          <div class="flex flex-col gap-1 border-t border-line pt-3">
            <div class="text-meta font-medium text-muted">Your answer</div>
            <div class="whitespace-pre-wrap wrap-anywhere">{text()}</div>
          </div>
        )}
      </Show>
    </ResolvedRow>
  );
}

/**
 * The prompt the answers become: picks and what was written, one line per
 * question when there are several, skipped ones said so.
 */
function answerText(questions: Question[], picks: string[][], notes: string[]) {
  const answer = (i: number) => {
    const chosen = (picks[i] ?? [])
      .map((l) => l.replace(/\s*\(Recommended\)$/, ''))
      .join(', ');
    const note = notes[i]?.trim() ?? '';
    return [chosen, note].filter(Boolean).join(' — ') || SKIPPED;
  };
  if (questions.length === 1) return answer(0);
  return questions
    .map((q, i) => `${q.header || q.question}: ${answer(i)}`)
    .join('\n');
}

const SKIPPED = '(skipped)';

/**
 * Each question's answer, read back from answerText's lines. Undefined for
 * a prompt typed in the composer that doesn't follow them, shown whole.
 */
function answersOf(questions: Question[], text: string | undefined) {
  if (text === undefined) return undefined;
  if (questions.length === 1) return [text];
  const labels = questions.map((q) => `${q.header || q.question}: `);
  const answers: string[] = [];
  for (const line of text.split('\n')) {
    const next = labels[answers.length];
    if (next && line.startsWith(next)) answers.push(line.slice(next.length));
    else if (answers.length) answers[answers.length - 1] += `\n${line}`;
    else return undefined;
  }
  return answers.length === questions.length ? answers : undefined;
}
