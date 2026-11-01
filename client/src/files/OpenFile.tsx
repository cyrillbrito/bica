import { useNavigate } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  untrack,
} from 'solid-js';

import { closeDrawer } from '../ui/layout';
import { useSettings } from '../settings';
import type { GitStatus, Workspace, WorkspaceRef } from '@bica/shared/protocol';
import {
  closeKept,
  downloadFile,
  isKept,
  keepOpen,
  workspaceHref,
  type Open,
} from './files';
import { repos, stage, useGitStatus, useLiveGitStatus } from '../git/git';
import CodeView from './CodeView';
import type { MenuEntry } from '../ui/ContextMenu';
import { IconButton } from '../ui/Button';
import { previewKind } from './FilePreview';
import { DownloadIcon, PinIcon, PreviewIcon, WrapIcon } from '../ui/icons';
import { Segmented, segmentClass } from '../ui/Segmented';
import { stored } from '../ui/stored';

// Side by side by default; remembered for the tab's lifetime.
const [split, setSplit] = createSignal(true);
// Rendered by default; remembered for the tab's lifetime.
const [preview, setPreview] = createSignal(true);
// Off by default; remembered per device.
const [wrap, setWrap] = stored('wrap', false);
function toggleWrap() {
  setWrap(!wrap());
}

/**
 * One file or diff, full size, with its File/Diff and Split/Unified
 * switches. `href` keeps those switches on the page it is shown in.
 */
export default function OpenFile(props: {
  workspace: { ref: WorkspaceRef; workspace: Workspace };
  open: Open;
  href: (open: Open) => string;
  // Extra buttons at the end of the header.
  actions?: JSX.Element;
}) {
  const navigate = useNavigate();
  const settings = useSettings();
  const ref = () => props.workspace.ref;
  const status = useGitStatus(ref);
  const find = (s: GitStatus | null | undefined) => {
    const o = props.open;
    if (!s) return undefined;
    for (const r of repos(s)) {
      const list = o.view === 'staged' ? r.staged : r.unstaged;
      const found = list.find((x) => x.path === o.path);
      if (found) return { ...found, repo: r.path };
    }
    return undefined;
  };
  // The change behind an open diff: its version re-reads the view.
  const change = createMemo(() => find(status()), { name: 'openChange' });
  // A diff reads its sides from the server's status, so they never mix
  // with a saved copy's, which could show an old diff for a moment.
  const liveStatus = useLiveGitStatus(ref);
  const shownChange = createMemo(
    () => (props.open.view === 'file' ? change() : find(liveStatus())),
    { name: 'shownChange' },
  );

  // Stage on view: seeing a change is reviewing it. The diff stays put,
  // now as Staged; later agent edits land under Changes again.
  createEffect(
    () => {
      const o = props.open;
      const x = change();
      if (!settings().stageOnView) return undefined;
      // Staging a conflict would mark it resolved.
      if (o.view !== 'changes' || !x || x.status === '!') return;
      return o.path;
    },
    (path) => {
      if (!path) return;
      const r = untrack(ref);
      const repo = untrack(() => change()?.repo);
      stage(r, [path], repo).then(
        () =>
          navigate(
            untrack(() => props.href({ path, view: 'staged' })),
            {
              replace: true,
            },
          ),
        // Not staged: the diff stays under Changes, nothing lost.
        () => {},
      );
    },
  );

  const o = () => props.open;
  const kept = () => isKept(ref(), o().path);
  const canPreview = () => o().view === 'file' && !!previewKind(o().path);
  const previewing = () => canPreview() && preview();
  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span class="min-w-0 flex-1 truncate font-mono text-meta">
          <Show when={change()?.oldPath}>
            {(old) => <span class="text-muted">{old()} → </span>}
          </Show>
          {o().path}
        </span>
        <span class="shrink-0 text-meta text-muted">
          {o().view === 'staged'
            ? 'Staged'
            : o().view === 'changes'
              ? 'Changes'
              : ''}
        </span>
        <Segmented>
          <a
            class={segmentClass}
            data-on={o().view === 'file' ? '' : undefined}
            href={props.href({ ...o(), view: 'file' })}
          >
            File
          </a>
          <a
            class={segmentClass}
            data-on={o().view !== 'file' ? '' : undefined}
            href={props.href({
              ...o(),
              view: o().view !== 'file' ? o().view : 'changes',
            })}
          >
            Diff
          </a>
        </Segmented>
        <Show when={o().view !== 'file'}>
          <Segmented class="max-md:hidden">
            <button
              class={segmentClass}
              data-on={split() ? '' : undefined}
              aria-pressed={split() ? 'true' : 'false'}
              onClick={() => setSplit(true)}
            >
              Split
            </button>
            <button
              class={segmentClass}
              data-on={split() ? undefined : ''}
              aria-pressed={split() ? 'false' : 'true'}
              onClick={() => setSplit(false)}
            >
              Unified
            </button>
          </Segmented>
        </Show>
        <Show when={canPreview()}>
          <IconButton
            size="md"
            class="aria-pressed:bg-active aria-pressed:text-accent"
            title={preview() ? 'Show the source' : 'Show it rendered'}
            aria-pressed={preview() ? 'true' : 'false'}
            onClick={() => setPreview(!preview())}
          >
            <PreviewIcon />
          </IconButton>
        </Show>
        <Show when={!previewing()}>
          <IconButton
            size="md"
            class="aria-pressed:bg-active aria-pressed:text-accent"
            title={wrap() ? 'Scroll long lines' : 'Wrap long lines'}
            aria-pressed={wrap() ? 'true' : 'false'}
            onClick={toggleWrap}
          >
            <WrapIcon />
          </IconButton>
        </Show>
        <IconButton
          size="md"
          class="aria-pressed:bg-active aria-pressed:text-accent"
          title={
            kept()
              ? 'Unpin: remove it from the sidebar'
              : 'Keep open in the sidebar'
          }
          aria-pressed={kept() ? 'true' : 'false'}
          onClick={() =>
            kept()
              ? closeKept(ref(), o().path)
              : keepAndShow(navigate, ref(), o())
          }
        >
          <PinIcon />
        </IconButton>
        <IconButton
          size="md"
          title="Download"
          onClick={() => void downloadFile(ref(), o().path)}
        >
          <DownloadIcon />
        </IconButton>
        {props.actions}
      </header>
      <CodeView
        workspace={ref()}
        path={o().path}
        view={o().view}
        oldPath={shownChange()?.oldPath}
        repo={shownChange()?.repo}
        version={shownChange()?.version}
        blobs={shownChange()?.blobs}
        split={split()}
        wrap={wrap()}
        preview={preview()}
      />
    </div>
  );
}

/** Keeps a file in the sidebar and shows it there, on its workspace page. */
export function keepAndShow(
  navigate: (href: string) => void,
  ref: WorkspaceRef,
  open: Open,
) {
  keepOpen(ref, open);
  closeDrawer();
  navigate(workspaceHref(ref, open));
}

/** "Keep open" for a file's right-click menu; absent once it is kept. */
export function keepOpenItem(
  navigate: (href: string) => void,
  ref: WorkspaceRef,
  open: Open | undefined,
): MenuEntry[] {
  return open && !isKept(ref, open.path)
    ? [
        {
          label: 'Keep open',
          icon: <PinIcon />,
          onSelect: () => keepAndShow(navigate, ref, open),
        },
      ]
    : [];
}
