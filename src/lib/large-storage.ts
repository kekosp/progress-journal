// ─── Large storage ────────────────────────────────────────────────────────────
// Reports, inventory, vault and comments hold photos, which quickly overflow the
// ~5 MB localStorage limit. These keys are kept in IndexedDB (hundreds of MB in
// the Android WebView) with an in-memory mirror, so the rest of the app keeps
// using the synchronous localStorage API unchanged.

const DB_NAME = 'app-large-store';
const STORE = 'kv';
export const LARGE_KEYS = ['reports-data', 'inventory-data', 'vault-data', 'report-comments', 'report-templates', 'activity-log'];

const cache = new Map<string, string>();
let db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db!.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
  });
}

// Serialise writes per key so the latest value always wins.
const pending = new Map<string, Promise<unknown>>();
function persist(key: string, value: string | null) {
  const prev = pending.get(key) ?? Promise.resolve();
  const next = prev.then(() =>
    tx('readwrite', s => (value == null ? s.delete(key) : s.put(value, key))),
  ).catch(e => console.error('[large-storage] write failed', key, e));
  pending.set(key, next);
}

/** Loads large keys into memory, migrates old localStorage copies, then patches Storage. */
export async function initLargeStorage(): Promise<void> {
  try {
    db = await openDb();
  } catch (e) {
    console.warn('[large-storage] IndexedDB unavailable, staying on localStorage', e);
    return;
  }
  const proto = Storage.prototype;
  const origGet = proto.getItem, origSet = proto.setItem, origRemove = proto.removeItem, origClear = proto.clear;

  for (const key of LARGE_KEYS) {
    const stored = await tx<string | undefined>('readonly', s => s.get(key));
    const legacy = origGet.call(localStorage, key);
    if (legacy != null && stored == null) {
      await tx('readwrite', s => s.put(legacy, key)); // migrate
    }
    const value = stored ?? legacy;
    if (value != null) cache.set(key, value);
    if (legacy != null) origRemove.call(localStorage, key); // frees the small store
  }

  const isLarge = (self: Storage, k: string) => self === localStorage && LARGE_KEYS.includes(k);
  proto.getItem = function (k: string) {
    return isLarge(this, k) ? (cache.get(k) ?? null) : origGet.call(this, k);
  };
  proto.setItem = function (k: string, v: string) {
    if (!isLarge(this, k)) return origSet.call(this, k, v);
    cache.set(k, String(v));
    persist(k, String(v));
  };
  proto.removeItem = function (k: string) {
    if (!isLarge(this, k)) return origRemove.call(this, k);
    cache.delete(k);
    persist(k, null);
  };
  proto.clear = function () {
    if (this === localStorage) for (const k of LARGE_KEYS) { cache.delete(k); persist(k, null); }
    return origClear.call(this);
  };

  // Ask the OS not to evict this storage.
  navigator.storage?.persist?.().catch(() => {});
}

/** Rough usage figures for display. */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  const est = await navigator.storage?.estimate?.();
  return est?.quota ? { usage: est.usage ?? 0, quota: est.quota } : null;
}
