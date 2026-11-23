import { Show, createSignal } from 'solid-js';

/**
 * An app's logo from Composio at 16px, or its first letter when there is
 * none or it fails to load. `tile` puts it in the 32px tile of a settings row.
 * Logos sit on white: many are black marks (GitHub, Notion) drawn for light.
 */
export default function AppLogo(props: {
  name: string;
  logo: string | null;
  tile?: boolean;
  muted?: boolean;
}) {
  const [broken, setBroken] = createSignal(false, { name: 'appLogoBroken' });
  const shown = () => !broken() && !!props.logo;
  return (
    <span
      class={[
        'grid shrink-0 place-items-center font-semibold',
        props.tile
          ? 'size-8 rounded-lg border border-line'
          : 'size-5 rounded-sm text-meta',
        shown() ? 'bg-paper' : props.tile && 'bg-well',
        (props.muted || !props.tile) && 'text-muted',
      ]}
      aria-hidden="true"
    >
      <Show
        when={shown() && props.logo}
        fallback={(props.name.trim()[0] ?? '?').toUpperCase()}
      >
        {(url) => (
          <img
            src={url()}
            alt=""
            class={[
              'object-contain',
              props.tile ? 'size-4' : 'size-3.5',
              props.muted && 'opacity-60',
            ]}
            loading="lazy"
            referrerpolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        )}
      </Show>
    </span>
  );
}
