import { useNavigate } from '@tanstack/react-router';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { CHANGES, FILE_PATHS } from '@/fixtures';
import { useUi } from '@/app/ui';

const GIT_STATUS = CHANGES.filter((c) => c.status !== 'deleted').map((c) => ({
  path: c.path,
  status: c.status,
}));

/** The whole tree with git colors and a name search, from Pierre. */
export function FilesTab({ workspace }: { workspace: string }) {
  const navigate = useNavigate();
  const ui = useUi();
  const { model } = useFileTree({
    paths: FILE_PATHS,
    gitStatus: GIT_STATUS,
    initialExpandedPaths: ['packages', 'packages/web', 'packages/web/src'],
    flattenEmptyDirectories: true,
    search: true,
    stickyFolders: true,
    itemHeight: 32,
    onSelectionChange: (ids) => {
      const path = ids[0];
      if (ids.length !== 1 || !path || !FILE_PATHS.includes(path)) return;
      ui.setPanel(false);
      void navigate({
        to: '/p/$id',
        params: { id: workspace },
        search: (prev) => ({ panel: prev.panel, file: path }),
      });
    },
  });
  return <FileTree model={model} className="file-tree block h-full" />;
}
