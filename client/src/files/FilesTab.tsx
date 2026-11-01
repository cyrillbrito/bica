import { useNavigate } from '@solidjs/router';

import type { GitStatus, WorkspaceRef } from '@bica/shared/protocol';
import { repos, useGitStatus } from '../git/git';
import { copyText } from '../ui/clipboard';
import { CodeIcon, CopyIcon, FilesIcon } from '../ui/icons';
import { closeDrawer } from '../ui/layout';
import { TREE_STATUS } from './ChangeList';
import FileTree from './FileTree';
import { openHref, openInEditor, useFiles, type Open } from './files';
import { keepOpenItem } from './OpenFile';

/** The side panel's Files tab: the workspace's tree, marked with git changes. */
export const filesTab = {
  id: 'files',
  label: 'Files',
  icon: FilesIcon,
  content: FilesTab,
};

function FilesTab(props: { workspace: WorkspaceRef; open: Open | undefined }) {
  const navigate = useNavigate();
  const status = useGitStatus(() => props.workspace);
  const files = useFiles(() => props.workspace);
  return (
    <FileTree
      paths={files()}
      remember={`${props.workspace.projectId}\n${props.workspace.cwd}`}
      status={treeStatus(status())}
      selected={props.open?.view === 'file' ? props.open.path : undefined}
      onOpen={(path) => {
        closeDrawer();
        navigate(openHref(props.workspace, { path, view: 'file' }));
      }}
      menu={(paths) => [
        ...keepOpenItem(
          navigate,
          props.workspace,
          paths.length === 1 ? { path: paths[0]!, view: 'file' } : undefined,
        ),
        ...(paths.length === 1
          ? [
              {
                label: 'Open in editor',
                icon: <CodeIcon />,
                onSelect: () => void openInEditor(props.workspace, paths[0]),
              },
            ]
          : []),
        {
          label: paths.length === 1 ? 'Copy path' : 'Copy paths',
          icon: <CopyIcon />,
          onSelect: () => void copyText(paths.join('\n')),
        },
      ]}
    />
  );
}

// Unstaged wins: it's what the file on disk looks like now.
function treeStatus(status: GitStatus | null | undefined) {
  const map = new Map<string, (typeof TREE_STATUS)[keyof typeof TREE_STATUS]>();
  for (const c of (status ? repos(status) : []).flatMap((r) => [
    ...r.staged,
    ...r.unstaged,
  ]))
    map.set(c.path, TREE_STATUS[c.status]);
  return [...map].map(([path, status]) => ({ path, status }));
}
