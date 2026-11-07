// Topic values saved on this device, so a page opens with what it showed
// last time while the live value loads. Only a cache: any of it may go.

const NAME = 'bica-topics';
// Bump when a topic's value changes shape, to drop the old copies.
const VERSION = 3;
const STORE = 'topics';
// Conversations reach a megabyte or more each.
const MAX = 40;

let db: Promise<IDBDatabase | undefined> | undefined;

function open() {
  return (db ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(NAME, VERSION);
      request.onupgradeneeded = () => {
        const d = request.result;
        if (d.objectStoreNames.contains(STORE)) d.deleteObjectStore(STORE);
        d.createObjectStore(STORE).createIndex('at', 'at');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    } catch {
      // No IndexedDB, as in some private windows: work without the cache.
      resolve(undefined);
    }
  }));
}

/** The saved value, or undefined if there is none. */
export async function readTopic(key: string): Promise<unknown> {
  const d = await open();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const request = d.transaction(STORE).objectStore(STORE).get(key);
      request.onsuccess = () =>
        resolve((request.result as { value: unknown } | undefined)?.value);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

/** Saves the value, dropping the least recently saved past the limit. */
export async function saveTopic(key: string, value: unknown) {
  const d = await open();
  if (!d) return;
  try {
    const store = d.transaction(STORE, 'readwrite').objectStore(STORE);
    store.put({ value, at: Date.now() }, key);
    const count = store.count();
    count.onsuccess = () => {
      let extra = count.result - MAX;
      if (extra <= 0) return;
      const cursor = store.index('at').openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c || extra-- <= 0) return;
        c.delete();
        c.continue();
      };
    };
  } catch (error) {
    console.warn('[topic-cache]', error);
  }
}
