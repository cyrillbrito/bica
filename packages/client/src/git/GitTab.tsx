import { Show } from 'solid-js';

import type { WorkspaceRef } from '@bica/shared/protocol';
import type { Open } from '../files/files';
import { asList, toggleAsList } from '../files/ChangeList';
import { IconButton } from '../ui/Button';
import Empty from '../ui/Empty';
import { DiffIcon, ListIcon, TreeIcon } from '../ui/icons';
import { useGitStatus } from './git';
import GitPanel from './GitPanel';

/** The side panel's Git tab. */
export const gitTab = {
  id: 'git',
  label: 'Git',
  icon: DiffIcon,
  actions: GitTabActions,
  content: GitTab,
};

function GitTab(props: { workspace: WorkspaceRef; open: Open | undefined }) {
  const status = useGitStatus(() => props.workspace);
  return (
    <Show when={status()} fallback={<Empty>Not a git repository</Empty>}>
      {(s) => (
        <GitPanel workspace={props.workspace} status={s()} open={props.open} />
      )}
    </Show>
  );
}

// In the panel's header while the Git tab is picked.
function GitTabActions() {
  return (
    <IconButton
      title={asList() ? 'Show changes as a tree' : 'Show changes as a list'}
      onClick={toggleAsList}
    >
      {asList() ? <TreeIcon /> : <ListIcon />}
    </IconButton>
  );
}
