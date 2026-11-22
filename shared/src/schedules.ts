// Words for a schedule's time (docs/schedules.md), the same in the browser
// and in what the agent reads.
import type { Schedule } from './protocol';

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function clock(hour: string, minute: string) {
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

/** The common cron shapes in words, such as "weekdays at 08:00"; others as they are. */
export function cronWords(cron: string) {
  const [minute, hour, day, month, weekday] = cron.trim().split(/\s+/);
  const fixed = (v?: string) => !!v && /^\d+$/.test(v);
  if (day !== '*' || month !== '*' || !fixed(minute)) return cron;
  if (hour === '*' && weekday === '*')
    return `every hour at :${minute!.padStart(2, '0')}`;
  if (!fixed(hour)) return cron;
  const at = clock(hour!, minute!);
  if (weekday === '*') return `every day at ${at}`;
  if (weekday === '1-5') return `weekdays at ${at}`;
  if (weekday === '0,6' || weekday === '6,0') return `weekends at ${at}`;
  if (fixed(weekday)) return `every ${DAYS[Number(weekday) % 7]} at ${at}`;
  return cron;
}

/** A moment as the user reads it, such as "Fri 8 May, 09:00". */
export function momentWords(at: number) {
  return new Date(at).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** When it fires, such as "once, Fri 8 May, 09:00" or "weekdays at 08:00". */
export function timeWords(time: Schedule['time']) {
  return 'at' in time ? `once, ${momentWords(time.at)}` : cronWords(time.cron);
}
