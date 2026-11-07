import {
  DragDropManager,
  Draggable,
  Feedback,
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
} from '@dnd-kit/dom';
import { createSignal, onCleanup, untrack } from 'solid-js';

import { closeContextMenu } from './ContextMenu';

export interface Drag {
  id: string;
  /** Where the dragged item's handle is drawn, following the pointer. */
  top: number;
  left: number;
  width: number;
  /** The item it would land before; null: after the last. */
  before: string | null;
}

/**
 * Drag to reorder, on dnd-kit's DOM layer for the pointer, touch, and
 * keyboard handling only. Nothing moves while dragging: the app draws a copy
 * of the handle from `drag()` and a line where it would land, and the list
 * may shrink meanwhile (dnd-kit's own feedback would fight both). Only an
 * element marked `data-drag-handle` starts a drag: a mouse after 5px, a
 * finger after a hold. That hold also opens the context menu, as on iOS:
 * lifting there keeps the menu, moving on drags and closes it.
 *
 *   const sortable = createSortable({ onDrop });
 *   <section ref={sortable.item(() => id)}>
 *     <h2 data-drag-handle>…</h2>
 */
export function createSortable(options: {
  onDrop: (id: string, before: string | null) => void;
}) {
  const manager = new DragDropManager({
    plugins: (defaults) =>
      defaults.map((p) =>
        p === Feedback ? Feedback.configure({ feedback: 'none' }) : p,
      ),
    sensors: [
      PointerSensor.configure({
        activationConstraints: (event) =>
          event.pointerType === 'touch'
            ? [
                new PointerActivationConstraints.Delay({
                  value: 450,
                  tolerance: 8,
                }),
              ]
            : [new PointerActivationConstraints.Distance({ value: 5 })],
        // Buttons inside the handle, like +, stay buttons.
        preventActivation: (event) => {
          const t = event.target as Element | null;
          return !t?.closest('[data-drag-handle]') || !!t.closest('button');
        },
      }),
      KeyboardSensor,
    ],
  });
  const elements = new Map<string, HTMLElement>();
  const [drag, setDrag] = createSignal<Drag | undefined>(undefined, {
    name: 'drag',
  });
  // Holds until the operation is idle, so list animations wait for the drop.
  const [dragging, setDragging] = createSignal(false, { name: 'dragging' });
  // Where the pointer picked it up, and how far below the handle's top.
  let start = { x: 0, y: 0 };
  let grab = 0;

  // The first item whose middle is below the pointer; the list is read fresh
  // each time, since it may have changed shape since the lift.
  const slot = (y: number) => {
    const items = [...elements]
      .map(([id, el]) => ({ id, rect: el.getBoundingClientRect() }))
      .sort((a, b) => a.rect.top - b.rect.top);
    return items.find((i) => y < i.rect.top + i.rect.height / 2)?.id ?? null;
  };

  manager.monitor.addEventListener('dragstart', (event) => {
    const id = String(event.operation.source?.id);
    const handle = elements
      .get(id)
      ?.querySelector<HTMLElement>('[data-drag-handle]');
    if (!handle) return;
    const rect = handle.getBoundingClientRect();
    start = { ...event.operation.position.current };
    const { y } = start;
    grab = y - rect.top;
    setDragging(true);
    setDrag({
      id,
      top: rect.top,
      left: rect.left,
      width: rect.width,
      before: null,
    });
    // The list may change shape on the lift: place the line once it has.
    requestAnimationFrame(() => setDrag((d) => d && { ...d, before: slot(y) }));
  });
  manager.monitor.addEventListener('dragmove', (event) => {
    const { x, y } = event.operation.position.current;
    if (Math.hypot(x - start.x, y - start.y) > 10) closeContextMenu();
    setDrag((d) => d && { ...d, top: y - grab, before: slot(y) });
  });
  manager.monitor.addEventListener('dragend', (event) => {
    const d = untrack(drag);
    setDrag(undefined);
    if (d && !event.canceled) options.onDrop(d.id, d.before);
    const settle = () =>
      manager.dragOperation.status.idle
        ? setDragging(false)
        : requestAnimationFrame(settle);
    requestAnimationFrame(settle);
  });
  onCleanup(() => manager.destroy());

  const item = (id: () => string) => {
    let draggable: Draggable | undefined;
    let key = '';
    onCleanup(() => {
      draggable?.destroy();
      elements.delete(key);
    });
    return (element: HTMLElement) => {
      key = untrack(id);
      elements.set(key, element);
      draggable = new Draggable({ id: key, element }, manager);
    };
  };
  return { item, drag, dragging };
}
