// One-time migration from older versions of this app:
//   1. the first local-only version (IndexedDB "duitku-db"), and
//   2. the "Ledger" cloud version (Firebase). Pulling from the cloud needs
//      internet once; the Firebase SDK is only loaded when you press the
//      button, so the app itself never depends on it.
// Both keep the original ids where they exist, so running either twice
// never creates duplicates. Safe to delete this file once migrated.
import { normalizeEntry } from './transfer.js';

const OLD_SPACE_KEY = 'duitku-space';
const FIREBASE_VERSION = '12.18.0';
const OLD_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDB53GJ1UXCWuyZnGb2-mhyIrqGfYiS0IM',
  authDomain: 'expense-tracker-3273c.firebaseapp.com',
  projectId: 'expense-tracker-3273c',
  storageBucket: 'expense-tracker-3273c.firebasestorage.app',
  messagingSenderId: '538857726344',
  appId: '1:538857726344:web:45bda080f1c716e4915a3d',
};

export function oldCloudSpaceToken() {
  try {
    return localStorage.getItem(OLD_SPACE_KEY);
  } catch {
    return null;
  }
}

export function readOldLocalEntries() {
  return new Promise((resolve) => {
    const req = indexedDB.open('duitku-db');
    req.onupgradeneeded = () => req.transaction.abort(); // it never existed: don't create it
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        db.close();
        resolve([]);
        return;
      }
      const getAll = db.transaction('entries', 'readonly').objectStore('entries').getAll();
      getAll.onsuccess = () => {
        db.close();
        resolve(safeNormalize(getAll.result || []));
      };
      getAll.onerror = () => {
        db.close();
        resolve([]);
      };
    };
    req.onerror = () => resolve([]);
    req.onblocked = () => resolve([]);
  });
}

function safeNormalize(list) {
  const out = [];
  list.forEach((e, i) => {
    try {
      out.push(normalizeEntry(e, i));
    } catch {
      /* skip malformed rows */
    }
  });
  return out;
}

// `token` = the space id from the old "secret access link" (#s=...).
export async function readOldCloudEntries(token) {
  if (!navigator.onLine) throw new Error('You are offline. Pulling from the old cloud needs internet once.');
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [{ initializeApp }, { getAuth, signInAnonymously }, fs] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(OLD_FIREBASE_CONFIG, 'oracle-legacy');
  await signInAnonymously(getAuth(app));
  const db = fs.getFirestore(app);
  const snap = await fs.getDocs(fs.collection(db, 'spaces', token, 'entries'));
  const entries = safeNormalize(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  let meta = null;
  try {
    const m = await fs.getDoc(fs.doc(db, 'spaces', token, 'meta', 'config'));
    meta = m.data() || null;
  } catch {
    meta = null;
  }
  return { entries, meta };
}

export function tokenFromLink(text) {
  const t = String(text || '').trim();
  const m = /[#&]s=([0-9a-f-]{36})/i.exec(t) || /^([0-9a-f-]{36})$/i.exec(t);
  return m ? m[1] : null;
}
