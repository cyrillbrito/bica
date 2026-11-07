import { For, Show, createSignal } from 'solid-js';

import { UploadIcon } from './icons';

function isFiles(e: DragEvent) {
  return [...(e.dataTransfer?.types ?? [])].includes('Files');
}

/**
 * A drop target (affectUI's Dropzone): spread `handlers` on a positioned
 * element and put `<Overlay />` inside it. While files are dragged over, an
 * outline shows and three little documents fan out, and the title counts
 * what would be taken. Files not matching `accept` (a MIME prefix like
 * "image/") are left out.
 */
export function createDropZone(props: {
  accept?: string;
  onFiles: (files: File[]) => void;
  // "image" → "Drop 2 images to attach".
  noun?: string;
}) {
  const [over, setOver] = createSignal(false, { name: 'dropOver' });
  const [count, setCount] = createSignal(0, { name: 'dropCount' });
  // Enter and leave fire for every child crossed; count them.
  let depth = 0;
  const fits = (type: string) => !props.accept || type.startsWith(props.accept);
  const noun = () => props.noun ?? 'file';

  const handlers = {
    onDragEnter: (e: DragEvent) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth++;
      setCount(
        [...(e.dataTransfer?.items ?? [])].filter(
          (i) => i.kind === 'file' && fits(i.type),
        ).length,
      );
      setOver(true);
    },
    onDragOver: (e: DragEvent) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = count() ? 'copy' : 'none';
    },
    onDragLeave: () => {
      if (--depth <= 0) {
        depth = 0;
        setOver(false);
      }
    },
    onDrop: (e: DragEvent) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const files = [...(e.dataTransfer?.files ?? [])].filter((f) =>
        fits(f.type),
      );
      if (files.length) props.onFiles(files);
    },
  };

  const Overlay = () => (
    <Show when={over()}>
      <div
        class={[
          'pointer-events-none absolute -inset-px z-10 grid place-items-center rounded-sheet border-2 border-dashed bg-surface/92 transition-opacity duration-150 starting:opacity-0',
          count() ? 'border-accent' : 'border-line-strong',
        ]}
        aria-hidden="true"
      >
        <div class="flex flex-col items-center gap-2">
          <div class="relative h-8 w-12">
            <For each={[-1, 0, 1]}>
              {(n) => (
                <span
                  class={[
                    'absolute top-0 left-1/2 -ml-2.5 grid h-7 w-5 place-items-center rounded-sm border bg-surface shadow-raised rotate-(--r) translate-x-(--x) translate-y-(--y) duration-300 ease-spring motion-safe:transition-[rotate,translate] starting:translate-0 starting:rotate-0',
                    count() ? 'border-accent/60' : 'border-line-strong',
                    n === 0 && 'z-10',
                  ]}
                  style={{
                    '--r': `${n * 14}deg`,
                    '--x': `${n * 11}px`,
                    '--y': `${Math.abs(n) * 2}px`,
                  }}
                >
                  <Show when={n === 0}>
                    <span class={count() ? 'text-accent' : 'text-muted'}>
                      <UploadIcon />
                    </span>
                  </Show>
                </span>
              )}
            </For>
          </div>
          <span class={['font-medium', count() ? 'text-fg' : 'text-muted']}>
            {count()
              ? `Drop ${count() === 1 ? `the ${noun()}` : `${count()} ${noun()}s`} to attach`
              : `Only ${noun()}s can be attached`}
          </span>
        </div>
      </div>
    </Show>
  );

  return { handlers, Overlay };
}
