import type { JSX } from '@solidjs/web';
import { Errored, Loading, Show, createMemo } from 'solid-js';

import { request } from '../socket/socket';
import Failed from '../ui/Failed';
import { IconButton } from '../ui/Button';
import { DownloadIcon, ExternalIcon } from '../ui/icons';
import FilePreview, { previewKind } from './FilePreview';

/**
 * A file outside every workspace, such as an agent's report in a temp
 * folder, read in place over the chat. It has no workspace to read through,
 * so it loads over the file's download link.
 */
export default function OutsideFile(props: {
  path: string;
  actions?: JSX.Element;
}) {
  // Links last an hour, so each opening asks for a fresh one.
  const url = createMemo(
    async () => {
      const found = await request('path.find', { path: props.path });
      if (!found.url) throw new Error(`${props.path} is not a file`);
      return found.url;
    },
    { name: 'outsideFileUrl' },
  );
  const kind = () => previewKind(props.path);
  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <header class="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span class="min-w-0 flex-1 truncate font-mono text-meta">
          {props.path}
        </span>
        <IconButton
          size="md"
          title="Open in a new tab"
          onClick={() => window.open(url(), '_blank')}
        >
          <ExternalIcon />
        </IconButton>
        <IconButton
          size="md"
          title="Download"
          onClick={() => {
            const link = document.createElement('a');
            link.href = `${url()}?download`;
            link.download = '';
            link.click();
          }}
        >
          <DownloadIcon />
        </IconButton>
        {props.actions}
      </header>
      <div class="min-h-0 flex-1 overflow-auto">
        <Errored fallback={(error) => <Failed error={error()} />}>
          <Loading>
            <Show
              when={kind() === 'markdown' || kind() === 'mermaid'}
              fallback={
                // The server sandboxes HTML itself, which leaves PDFs free to
                // render, and serves other text as plain text.
                <iframe
                  src={url()}
                  title={props.path}
                  class="block h-full w-full bg-paper"
                />
              }
            >
              <Rendered url={url()} path={props.path} />
            </Show>
          </Loading>
        </Errored>
      </div>
    </div>
  );
}

function Rendered(props: { url: string; path: string }) {
  const text = createMemo(
    async () => {
      const res = await fetch(props.url);
      if (!res.ok) throw new Error(`${props.path} can't be read`);
      return res.text();
    },
    { name: 'outsideFileText' },
  );
  return (
    <FilePreview
      kind={previewKind(props.path)!}
      text={text()}
      path={props.path}
    />
  );
}
