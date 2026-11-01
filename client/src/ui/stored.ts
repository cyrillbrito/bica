import { createSignal, type Accessor } from 'solid-js';

/** Where `stored(key)` keeps its value, for boot scripts that read it first. */
export function storageKey(key: string) {
  return `bica.${key}`;
}

/**
 * A setting kept on this device, not on the server: a phone and a laptop
 * may want different ones. The default is never written, so a new default
 * reaches everyone who never picked. Strings are stored as they are, so a
 * boot script can read them; anything else as JSON. A stored value of the
 * wrong type, or outside `allowed`, reads as the default.
 */
export function stored<T>(
  key: string,
  fallback: T,
  allowed?: readonly T[],
): [Accessor<T>, (value: T) => void] {
  const name = storageKey(key);
  const encode = (v: T) =>
    typeof fallback === 'string' ? String(v) : JSON.stringify(v);

  const read = (): T => {
    // Document.tsx imports some of these, and the build renders it under Bun.
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(name);
    if (raw === null) return fallback;
    let value: unknown = raw;
    if (typeof fallback !== 'string')
      try {
        value = JSON.parse(raw);
      } catch {
        return fallback;
      }
    const ok = allowed
      ? allowed.includes(value as T)
      : typeof value === typeof fallback;
    return ok ? (value as T) : fallback;
  };

  // A setting is plain data, never a function Solid would call.
  const [value, set] = createSignal<T>(read() as Exclude<T, Function>, {
    name,
  });
  const save = (next: T) => {
    set(() => next);
    try {
      if (encode(next) === encode(fallback)) localStorage.removeItem(name);
      else localStorage.setItem(name, encode(next));
    } catch {
      // Full: the setting still holds for this visit.
    }
  };
  return [value, save];
}
