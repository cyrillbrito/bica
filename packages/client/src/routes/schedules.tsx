import { Title } from '@solidjs/meta';
import { onSettled } from 'solid-js';

import ScheduleList from '../schedules/ScheduleList';
import TopBar from '../app/TopBar';
import { ClockIcon } from '../ui/icons';
import { setNoPanels } from '../ui/layout';

/** Every schedule (docs/schedules.md). They belong to no workspace, so no side panel. */
export default function SchedulesPage() {
  onSettled(() => {
    setNoPanels(true);
    return () => setNoPanels(false);
  });
  return (
    <>
      <Title>Schedules</Title>
      <TopBar>
        <span class="text-muted">
          <ClockIcon />
        </span>
        <h1 class="font-semibold">Schedules</h1>
      </TopBar>
      <ScheduleList />
    </>
  );
}
