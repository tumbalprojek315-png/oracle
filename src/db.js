// Tiny promise wrapper over IndexedDB — the app's only storage. Everything
// lives on the device it was logged on; moving data between devices is done
// with sync files (see transfer.js), so the app works fully offline.
const DB_NAME = 'orbit-db'; // internal name, kept from the app's first release so saved data stays readable
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) db.createObjectStore('entries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => {
      const db = req.result;
      // another tab upgrading or deleting the database: let go instead of blocking it
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database is blocked by another open tab. Close other tabs and reload.'));
  });
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

export async function getAllEntries() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction('entries', 'readonly').objectStore('entries').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putEntries(list) {
  if (!list.length) return;
  const db = await open();
  const tx = db.transaction('entries', 'readwrite');
  const store = tx.objectStore('entries');
  for (const e of list) store.put(e);
  await done(tx);
}

export async function deleteEntriesHard(ids) {
  const db = await open();
  const tx = db.transaction('entries', 'readwrite');
  for (const id of ids) tx.objectStore('entries').delete(id);
  await done(tx);
}

export async function kvGet(key) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function kvSet(key, value) {
  const db = await open();
  const tx = db.transaction('kv', 'readwrite');
  tx.objectStore('kv').put(value, key);
  await done(tx);
}

// Ask the browser not to evict our data under storage pressure. Without this,
// mobile browsers may clear IndexedDB of sites you haven't opened in a while.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* not supported — nothing to do */
  }
  return false;
}
