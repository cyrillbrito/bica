import { For, Show, createMemo } from 'solid-js';
import { readError } from './error-message';
import { CopyButton } from '../ui/CopyButton';
import Summary from '../ui/Summary';
import { AlertIcon } from '../ui/icons';
import Chevron from '../ui/Chevron';
import { buttonClass } from '../ui/Button';
import { paths } from '../router';

/** A failed turn: the readable reason up front, the raw response folded away. */
export default function ErrorReply(props: { text: string }) {
  const error = createMemo(() => readError(props.text), { name: 'readError' });
  return (
    <div
      class="min-w-0 rounded-card border border-danger/30 bg-danger/5 px-3 py-2.5"
      role="alert"
    >
      <div class="flex items-start gap-2">
        <span class="mt-0.5 text-danger">
          <AlertIcon />
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-meta font-medium text-danger">
            {error().signIn
              ? 'Sign-in expired'
              : error().status
                ? `Error ${error().status}`
                : 'Error'}
          </div>
          <p class="mt-0.5 text-ui text-pretty whitespace-pre-wrap wrap-anywhere text-fg">
            <Linked text={error().message} />
          </p>
          <Show when={error().signIn}>
            <a
              href={`${paths.settings()}#providers`}
              class={[
                buttonClass({ variant: 'outline', size: 'sm' }),
                'mt-2 w-fit',
              ]}
            >
              Open Providers
            </a>
          </Show>
        </div>
        <CopyButton
          title="Copy error"
          text={() => props.text}
          class="-mt-0.5 -mr-1 text-muted"
        />
      </div>
      <Show when={error().details}>
        {(details) => (
          <details class="group/err expand mt-1.5 md:ml-4">
            <Summary class="w-fit text-meta">
              <Chevron class="group-open/err:rotate-90" />
              Full response
            </Summary>
            <pre class="mt-1 rounded-md md:max-h-80 md:overflow-auto md:overscroll-contain border border-line bg-bg px-2.5 py-2 font-mono text-code whitespace-pre-wrap wrap-anywhere text-muted">
              {details()}
            </pre>
          </details>
        )}
      </Show>
    </div>
  );
}

function Linked(props: { text: string }) {
  const parts = () => props.text.split(/(https?:\/\/[^\s"'<>)]+)/);
  return (
    <For each={parts()} keyed={false}>
      {(part, i) =>
        i % 2 ? (
          <a
            href={part()}
            target="_blank"
            rel="noreferrer"
            class="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
          >
            {part()}
          </a>
        ) : (
          <>{part()}</>
        )
      }
    </For>
  );
}
