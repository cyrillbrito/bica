import { Show, createSignal, onCleanup } from 'solid-js';

import { copyText } from './clipboard';
import { IconButton, type Size } from './Button';
import { CopyIcon, DrawnCheckIcon } from './icons';

/**
 * Copy, where the icon itself confirms: it blurs into a check that draws in,
 * and turns back after a moment (affectUI's Message Actions). No toast.
 * `text` is read on click, so it can be a getter over live content.
 */
export function CopyButton(props: {
  text: () => string;
  title?: string;
  size?: Size;
  class?: string;
}) {
  const [copied, setCopied] = createSignal(false, { name: 'copied' });
  // The copy icon swaps back in only after a copy, not on first paint.
  const [used, setUsed] = createSignal(false, { name: 'copyUsed' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));
  const copy = async () => {
    if (!(await copyText(props.text(), { quiet: true }))) return;
    setCopied(true);
    setUsed(true);
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 1400);
  };
  const title = () => (copied() ? 'Copied' : (props.title ?? 'Copy'));
  return (
    <IconButton
      size={props.size ?? 'sm'}
      title={title()}
      aria-label={title()}
      class={[props.class, copied() && 'text-running!']}
      onClick={() => void copy()}
    >
      <Show
        when={copied()}
        fallback={
          <span class={used() ? 'swap-in' : 'inline-flex'}>
            <CopyIcon />
          </span>
        }
      >
        <span class="swap-in">
          <DrawnCheckIcon />
        </span>
      </Show>
    </IconButton>
  );
}
