// Project storage in IndexedDB: one record per project with its serialized
// font, app settings and a small preview string. Falls back to memory when
// IndexedDB is unavailable (private windows in some browsers).

// Projects and settings live in their own database. The handoff from the
// landing page uses the `fontsketch-handoff` database (version 1), store `handoff`, which
// is only ever opened without a version (and created at version 1 when
// missing), so the site and the editor never fight over schema versions.
const DB = 'fontsketch-editor';
const STORE = 'projects';
const HANDOFF_DB = 'fontsketch-handoff';
let dbp = null;
const memory = new Map();

function openDb(name, stores, version) {
  return new Promise((resolve) => {
    try {
      const req = version ? indexedDB.open(name, version) : indexedDB.open(name);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [store, opts] of stores) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, opts);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Opens a database at its current version, adding missing stores with a one step upgrade. */
async function openWith(name, stores) {
  const db = await openDb(name, stores, 0);
  if (!db) return null;
  if (stores.every(([s]) => db.objectStoreNames.contains(s))) return db;
  const v = db.version + 1;
  db.close();
  return openDb(name, stores, v);
}

function open() {
  if (!dbp) dbp = openWith(DB, [[STORE, { keyPath: 'id' }], ['settings', undefined]]);
  return dbp;
}
const openHandoff = () => openWith(HANDOFF_DB, [['handoff', undefined]]);

/** Reads and deletes a value from a key value store (used for the hero handoff). */
export async function takeHandoff(key, store = 'handoff') {
  const db = await openHandoff();
  if (!db) return undefined;
  const value = await new Promise((resolve) => {
    const t = db.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    const req = s.get(key);
    req.onsuccess = () => {
      s.delete(key);
      resolve(req.result);
    };
    req.onerror = () => resolve(undefined);
  });
  db.close();
  return value;
}

export async function getSetting(key) {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const req = db.transaction('settings', 'readonly').objectStore('settings').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}

export async function setSetting(key, value) {
  const db = await open();
  if (!db) return;
  await new Promise((resolve) => {
    const t = db.transaction('settings', 'readwrite');
    t.objectStore('settings').put(value, key);
    t.oncomplete = resolve;
    t.onerror = resolve;
  });
}

/** Stores a value for the editor to pick up (same database, `handoff` store). */
export async function putHandoff(key, value) {
  const db = await openHandoff();
  if (!db) return false;
  await new Promise((resolve) => {
    const t = db.transaction('handoff', 'readwrite');
    t.objectStore('handoff').put(value, key);
    t.oncomplete = resolve;
    t.onerror = resolve;
  });
  db.close();
  return true;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** @returns {Promise<Array<{ id: string, name: string, updated: number, glyphs: number, sample: string }>>} */
export async function listProjects() {
  const db = await open();
  const all = db ? await tx(db, 'readonly', (s) => s.getAll()) : [...memory.values()];
  return (all || [])
    .map(({ id, name, updated, glyphs, sample }) => ({ id, name, updated, glyphs, sample }))
    .sort((a, b) => b.updated - a.updated);
}

export async function loadProject(id) {
  const db = await open();
  return db ? tx(db, 'readonly', (s) => s.get(id)) : memory.get(id);
}

export async function saveProject(record) {
  const db = await open();
  if (!db) {
    memory.set(record.id, record);
    return;
  }
  await tx(db, 'readwrite', (s) => s.put(record));
}

export async function deleteProject(id) {
  const db = await open();
  if (!db) {
    memory.delete(id);
    return;
  }
  await tx(db, 'readwrite', (s) => s.delete(id));
}

export const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
