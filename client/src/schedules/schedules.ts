import type { Calls } from '@bica/shared/protocol';
import { request, useTopic } from '../socket/socket';

// Schedules (docs/schedules.md): the list, and the calls the page and the
// composer make.

export function useSchedules() {
  return useTopic('schedules', () => ({}));
}

export function createSchedule(args: Calls['schedule.create']['args']) {
  return request('schedule.create', args);
}

export function deleteSchedule(id: string) {
  return request('schedule.delete', { id });
}
