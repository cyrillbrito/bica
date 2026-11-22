import { Title } from '@solidjs/meta';
import { type RouteProps } from '@solidjs/router';
import { For, Show, createMemo, onSettled } from 'solid-js';

import ArtifactViewer from '../../artifacts/ArtifactViewer';
import {
  artifactMode,
  artifactTheme,
  pageUrl,
  setArtifactMode,
  setArtifactTheme,
  useArtifacts,
  type ArtifactMode,
} from '../../artifacts/artifacts';
import TopBar from '../../app/TopBar';
import { IconButton } from '../../ui/Button';
import Empty from '../../ui/Empty';
import Select from '../../ui/Select';
import { Segmented, segmentClass } from '../../ui/Segmented';
import {
  ArtifactIcon,
  DownloadIcon,
  ExternalIcon,
  MoonIcon,
  SunIcon,
  SystemThemeIcon,
} from '../../ui/icons';
import { setNoPanels } from '../../ui/layout';
import { theme as appTheme } from '../../ui/theme';

const MODES: { id: ArtifactMode; label: string; icon: typeof SunIcon }[] = [
  { id: 'bica', label: 'Match Bica', icon: SystemThemeIcon },
  { id: 'light', label: 'Light', icon: SunIcon },
  { id: 'dark', label: 'Dark', icon: MoonIcon },
];

/** One artifact full page, with its theme and light or dark (docs/artifacts.md). */
export default function ArtifactPage(props: RouteProps<'/artifacts/:name'>) {
  const artifacts = useArtifacts();
  const info = createMemo(
    () => artifacts().list.find((a) => a.name === props.params.name),
    { name: 'artifactInfo' },
  );
  onSettled(() => {
    setNoPanels(true);
    return () => setNoPanels(false);
  });
  const mode = () => (artifactMode() === 'bica' ? appTheme() : artifactMode());
  const query = () => ({ theme: artifactTheme(), mode: mode() });

  return (
    <Show
      when={info()}
      fallback={
        <>
          <TopBar />
          <Empty icon={<ArtifactIcon />} title="Artifact not found">
            Its file was renamed or removed.
          </Empty>
        </>
      }
    >
      {(a) => (
        <>
          <Title>{a().title}</Title>
          <TopBar
            actions={
              <>
                <Select
                  title="Theme"
                  aria-label="Theme"
                  onChange={(e) => setArtifactTheme(e.currentTarget.value)}
                >
                  <For each={artifacts().themes}>
                    {(t) => (
                      // `selected`, not the select's `value`, which is set
                      // before the options exist.
                      <option value={t.id} selected={t.id === artifactTheme()}>
                        {t.label}
                      </option>
                    )}
                  </For>
                </Select>
                <Segmented class="mr-1">
                  <For each={MODES}>
                    {(m) => (
                      <button
                        type="button"
                        class={[segmentClass, 'px-1.5 touch:px-2.5']}
                        title={m.label}
                        aria-label={m.label}
                        data-on={artifactMode() === m.id || undefined}
                        aria-pressed={
                          artifactMode() === m.id ? 'true' : 'false'
                        }
                        onClick={() => setArtifactMode(m.id)}
                      >
                        <m.icon />
                      </button>
                    )}
                  </For>
                </Segmented>
                <IconButton
                  title="Open in a new tab"
                  class="max-md:hidden"
                  onClick={() =>
                    window.open(pageUrl(a().name, query()), '_blank')
                  }
                >
                  <ExternalIcon />
                </IconButton>
                <IconButton
                  title="Export as one HTML file"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = pageUrl(a().name, { ...query(), download: '' });
                    link.download = `${a().name}.html`;
                    link.click();
                  }}
                >
                  <DownloadIcon />
                </IconButton>
              </>
            }
          >
            <h1 class="truncate font-semibold">{a().title}</h1>
          </TopBar>
          <ArtifactViewer
            name={a().name}
            title={a().title}
            updated={a().updated}
          />
        </>
      )}
    </Show>
  );
}
