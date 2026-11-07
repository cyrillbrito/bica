const KEY_STEP = 16;

/** Drag handle on a column edge. `side` is the edge it sits on. */
export default function Resizer(props: {
  side: 'left' | 'right';
  label: string;
  width: number;
  min: number;
  initial: number;
  max: number;
  onResize: (width: number) => void;
  class?: string;
}) {
  const clamp = (w: number) =>
    Math.round(Math.min(props.max, Math.max(props.min, w)));
  // Dragging right grows a column whose handle is on its right edge.
  const sign = () => (props.side === 'right' ? 1 : -1);

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = props.width;
    // Keep the cursor and stop text selection while the pointer leaves the handle.
    document.documentElement.classList.add('cursor-col-resize', 'select-none');

    const onMove = (m: PointerEvent) =>
      props.onResize(clamp(startW + sign() * (m.clientX - startX)));
    const onUp = () => {
      document.documentElement.classList.remove(
        'cursor-col-resize',
        'select-none',
      );
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    props.onResize(clamp(props.width + delta * sign()));
  };

  return (
    <div
      class={[
        'group absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none outline-none',
        props.side === 'right' ? '-right-1' : '-left-1',
        props.class,
      ]}
      role="separator"
      aria-orientation="vertical"
      aria-label={props.label}
      aria-valuenow={props.width}
      aria-valuemin={props.min}
      aria-valuemax={props.max}
      tabindex="0"
      title="Drag to resize, double-click to reset"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDblClick={() => props.onResize(clamp(props.initial))}
    >
      <div class="mx-auto h-full w-px transition-colors group-hover:bg-line-strong group-focus-visible:bg-accent group-active:bg-accent" />
    </div>
  );
}
