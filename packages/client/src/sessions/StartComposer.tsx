import { useNavigate } from '@solidjs/router';
import { createSignal } from 'solid-js';

import { useSettings } from '../settings';
import type { PromptImage } from '@bica/shared/protocol';
import { startSession } from './sessions';
import { startCall } from '../voice/voice';
import { paths } from '../router';
import Composer, { type ComposerApi } from './Composer';
import ModelPicker from '../models/ModelPicker';
import { ClockIcon } from '../ui/icons';
import ScheduleDialog, {
  type SchedulePicker,
} from '../schedules/ScheduleDialog';
import { errorText } from '../ui/errors';
import { toast } from '../ui/Toast';

export interface StartTarget {
  projectId: string;
  cwd: string;
  worktree?: boolean;
}

/**
 * The composer for a new session: send, or start with a voice call, and
 * land in the session. Used on the home page and on a workspace's page.
 */
export default function StartComposer(props: {
  target: StartTarget | undefined;
  // Where the typed draft is kept, e.g. "new" on the home page.
  draft: string;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const settings = useSettings();
  // Picking here sets only the session about to start; Settings holds the
  // default, so one session's pick never leaks into the next.
  const [choice, setChoice] = createSignal(
    () => ({
      model: settings().model,
      thinkingLevel: settings().thinkingLevel,
    }),
    { name: 'startChoice' },
  );

  const create = async (prompt: string, images: PromptImage[]) => {
    const t = props.target;
    if (!t) throw new Error('No project');
    const { id, warning } = await startSession(
      t.projectId,
      t.cwd,
      prompt,
      images,
      choice(),
      t.worktree || undefined,
    );
    navigate(paths.s(id));
    if (warning) toast.info(warning);
    return id;
  };
  let composer: ComposerApi | undefined;
  let picker: SchedulePicker | undefined;
  // Schedule…: the prompt runs later instead (docs/schedules.md).
  const schedule = (prompt: string, images: PromptImage[]) => {
    if (images.length) {
      composer?.problem('A schedule takes text only, without images.');
      return Promise.reject(new Error('Images'));
    }
    if (!props.target) return Promise.reject(new Error('No project'));
    return picker!.pick(prompt);
  };
  // An empty session with a call on it: the first thing said is the prompt.
  const call = () => {
    const id = create('', []);
    id.catch((error) => composer?.problem(errorText(error)));
    void startCall(id);
  };
  return (
    <>
      <Composer
        onSend={(prompt, images, _steer, later) =>
          later ? schedule(prompt, images) : create(prompt, images)
        }
        draft={props.draft}
        ref={(api) => (composer = api)}
        placeholder={props.placeholder ?? 'Start a new session…'}
        onCall={call}
        alternate={{
          label: 'Schedule…',
          hint: 'Start it later, or on a repeat',
          icon: <ClockIcon />,
        }}
        controls={<ModelPicker value={choice()} onChange={setChoice} />}
      />
      <ScheduleDialog
        ref={(p) => (picker = p)}
        target={() => props.target}
        choice={choice}
      />
    </>
  );
}
