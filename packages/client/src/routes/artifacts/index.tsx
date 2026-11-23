import { Title } from '@solidjs/meta';
import { onSettled } from 'solid-js';

import ArtifactList from '../../artifacts/ArtifactList';
import TopBar from '../../app/TopBar';
import { ArtifactIcon } from '../../ui/icons';
import { setNoPanels } from '../../ui/layout';

/** Every artifact (docs/artifacts.md). They belong to no workspace, so no side panel. */
export default function ArtifactsPage() {
  onSettled(() => {
    setNoPanels(true);
    return () => setNoPanels(false);
  });
  return (
    <>
      <Title>Artifacts</Title>
      <TopBar>
        <span class="text-muted">
          <ArtifactIcon />
        </span>
        <h1 class="font-semibold">Artifacts</h1>
      </TopBar>
      <ArtifactList />
    </>
  );
}
