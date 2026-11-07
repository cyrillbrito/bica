import { Loading, Match, Switch } from 'solid-js';

import Markdown from '../markdown/Markdown';
import Mermaid from '../markdown/Mermaid';

export type PreviewKind = 'markdown' | 'html' | 'mermaid';

/** What a file renders as in preview, or nothing when it only shows as code. */
export function previewKind(path: string): PreviewKind | undefined {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'mmd' || ext === 'mermaid') return 'mermaid';
  return undefined;
}

/** A file shown as what it makes: formatted Markdown, a page, a diagram. */
export default function FilePreview(props: {
  kind: PreviewKind;
  text: string;
  path: string;
}) {
  return (
    <Switch>
      <Match when={props.kind === 'markdown'}>
        <div class="mx-auto max-w-3xl px-4 py-6">
          <Markdown text={props.text} />
        </div>
      </Match>
      <Match when={props.kind === 'html'}>
        {/* Scripts run, but in their own origin: no access to Bica. */}
        <iframe
          srcdoc={props.text}
          sandbox="allow-scripts allow-popups allow-forms"
          title={props.path}
          class="block h-full w-full bg-paper"
        />
      </Match>
      <Match when={props.kind === 'mermaid'}>
        <Loading>
          <Mermaid text={props.text} class="p-6" />
        </Loading>
      </Match>
    </Switch>
  );
}
