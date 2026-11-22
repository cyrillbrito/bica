import { useNavigate } from '@solidjs/router';
import { For, Show, createSignal } from 'solid-js';

import type { ModelChoice, Schedule } from '@bica/shared/protocol';
import { cronWords, momentWords } from '@bica/shared/schedules';
import { paths } from '../router';
import Alert from '../ui/Alert';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import Input from '../ui/Input';
import { Segmented, segmentClass } from '../ui/Segmented';
import Select from '../ui/Select';
import { errorText } from '../ui/errors';
import { toast } from '../ui/Toast';
import { createSchedule } from './schedules';

export interface SchedulePicker {
  // Resolves once scheduled; rejects when the dialog closes without it, so
  // the composer gets its text back.
  pick: (prompt: string) => Promise<unknown>;
}

type Repeat = 'daily' | 'weekdays' | 'weekly' | 'cron';

const REPEATS: { id: Repeat; label: string }[] = [
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Every week' },
  { id: 'cron', label: 'Cron' },
];

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** A `datetime-local` value: tomorrow at 09:00. */
function tomorrowMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
}

/**
 * Schedule… from the composer's send menu (docs/schedules.md): once at a
 * date and time, or on a repeat. Each run starts a new session there.
 */
export default function ScheduleDialog(props: {
  ref: (picker: SchedulePicker) => void;
  target: () =>
    | { projectId: string; cwd: string; worktree?: boolean }
    | undefined;
  choice: () => ModelChoice;
}) {
  const navigate = useNavigate();
  let dialog!: HTMLDialogElement;
  let waiting: { prompt: string; done: (ok: boolean) => void } | undefined;
  const [mode, setMode] = createSignal<'once' | 'repeat'>('once', {
    name: 'scheduleMode',
  });
  const [at, setAt] = createSignal('', { name: 'scheduleAt' });
  const [repeat, setRepeat] = createSignal<Repeat>('weekdays', {
    name: 'scheduleRepeat',
  });
  const [clock, setClock] = createSignal('08:00', { name: 'scheduleClock' });
  const [weekday, setWeekday] = createSignal('1', { name: 'scheduleDay' });
  const [cron, setCron] = createSignal('', { name: 'scheduleCron' });
  const [error, setError] = createSignal('', { name: 'scheduleError' });
  const [saving, setSaving] = createSignal(false, { name: 'scheduleSaving' });

  const cronOf = () => {
    if (repeat() === 'cron') return cron().trim();
    const [h = '8', m = '0'] = clock().split(':');
    const days =
      repeat() === 'daily' ? '*' : repeat() === 'weekdays' ? '1-5' : weekday();
    return `${Number(m)} ${Number(h)} * * ${days}`;
  };
  const time = (): Schedule['time'] =>
    mode() === 'once' ? { at: new Date(at()).getTime() } : { cron: cronOf() };
  const words = () => {
    const t = time();
    if ('cron' in t) return t.cron ? cronWords(t.cron) : '';
    return Number.isNaN(t.at) ? '' : momentWords(t.at);
  };

  const picker: SchedulePicker = {
    pick: (prompt) =>
      new Promise((resolve, reject) => {
        waiting = {
          prompt,
          done: (ok) =>
            ok ? resolve(undefined) : reject(new Error('Not scheduled')),
        };
        dialog.showModal();
      }),
  };

  const save = async (e: SubmitEvent) => {
    e.preventDefault();
    const t = props.target();
    if (!waiting || !t) return;
    setSaving(true);
    setError('');
    try {
      const made = await createSchedule({
        prompt: waiting.prompt,
        time: time(),
        projectId: t.projectId,
        cwd: t.cwd,
        worktree: t.worktree || undefined,
        choice: props.choice(),
      });
      waiting.done(true);
      waiting = undefined;
      dialog.close();
      toast(
        {
          title: 'Scheduled',
          description: made.next
            ? 'cron' in made.time
              ? `${cronWords(made.time.cron)}, next ${momentWords(made.next)}`
              : momentWords(made.next)
            : undefined,
        },
        {
          action: {
            label: 'Schedules',
            onClick: () => navigate(paths.schedules()),
          },
        },
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      ref={(el) => {
        dialog = el;
        props.ref(picker);
      }}
      title="Schedule"
      onOpen={() => {
        if (!at()) setAt(tomorrowMorning());
        setError('');
      }}
      onClose={() => {
        waiting?.done(false);
        waiting = undefined;
      }}
      footer={
        <Button
          variant="primary"
          type="submit"
          form="schedule-form"
          loading={saving()}
          disabled={!words()}
        >
          Schedule
        </Button>
      }
    >
      <form
        id="schedule-form"
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 *:shrink-0"
        onSubmit={save}
      >
        <Show when={error()}>
          <Alert>{error()}</Alert>
        </Show>
        <Segmented class="self-start">
          <For each={['once', 'repeat'] as const}>
            {(m) => (
              <button
                type="button"
                class={segmentClass}
                data-on={mode() === m || undefined}
                aria-pressed={mode() === m ? 'true' : 'false'}
                onClick={() => setMode(m)}
              >
                {m === 'once' ? 'Once' : 'Repeat'}
              </button>
            )}
          </For>
        </Segmented>
        <Show
          when={mode() === 'repeat'}
          fallback={
            <Input
              type="datetime-local"
              class="h-8 self-start rounded-lg"
              value={at()}
              onInput={(e) => setAt(e.currentTarget.value)}
              aria-label="Date and time"
              required
            />
          }
        >
          <div class="flex flex-wrap items-center gap-2">
            <Select
              value={repeat()}
              onChange={(e) => setRepeat(e.currentTarget.value as Repeat)}
              aria-label="How often"
            >
              <For each={REPEATS}>
                {(r) => <option value={r.id}>{r.label}</option>}
              </For>
            </Select>
            <Show when={repeat() === 'weekly'}>
              <Select
                value={weekday()}
                onChange={(e) => setWeekday(e.currentTarget.value)}
                aria-label="Day"
              >
                <For each={DAYS}>
                  {(d, i) => <option value={String((i() + 1) % 7)}>{d}</option>}
                </For>
              </Select>
            </Show>
            <Show
              when={repeat() === 'cron'}
              fallback={
                <Input
                  type="time"
                  class="h-8 rounded-lg"
                  value={clock()}
                  onInput={(e) => setClock(e.currentTarget.value)}
                  aria-label="Time"
                  required
                />
              }
            >
              <Input
                class="h-8 flex-1 rounded-lg font-mono"
                value={cron()}
                onInput={(e) => setCron(e.currentTarget.value)}
                placeholder="0 8 * * 1-5"
                aria-label="Cron expression"
                required
              />
            </Show>
          </div>
        </Show>
        <p class="text-meta text-muted">
          <Show when={words()} fallback="Pick when it runs.">
            {(w) => (
              <>
                Runs {mode() === 'once' ? 'on ' : ''}
                {w()},{' '}
              </>
            )}
          </Show>
          in the dev machine's time.{' '}
          {mode() === 'once'
            ? 'It starts a new session with this prompt.'
            : 'Each run starts a new session with this prompt.'}
        </p>
      </form>
    </Dialog>
  );
}
