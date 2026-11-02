// Offline support. App files: network-first (so a new version shows up on the
// next online open, no manual cache bumps needed), falling back to the cache
// when offline. Google Fonts: cache-first once fetched.
const CACHE = 'oracle-v15';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/categories.js',
  './src/components/amountKeypad.js',
  './src/components/charts.js',
  './src/components/chips.js',
  './src/components/datePicker.js',
  './src/components/editableList.js',
  './src/components/entryForm.js',
  './src/components/periodSelector.js',
  './src/components/sheet.js',
  './src/components/textChipField.js',
  './src/config.js',
  './src/db.js',
  './src/dom.js',
  './src/entryActions.js',
  './src/format.js',
  './src/i18n-id.js',
  './src/i18n.js',
  './src/icons.js',
  './src/legacy.js',
  './src/legal.js',
  './src/main.js',
  './src/mealTime.js',
  './src/notifications.js',
  './src/periods.js',
  './src/serverStatus.js',
  './src/store.js',
  './src/styles.css',
  './src/transfer.js',
  './src/views/activityView.js',
  './src/views/homeView.js',
  './src/views/insightsView.js',
  './src/views/syncView.js',
  './src/views/onboarding.js',
  './src/tour.js',
  './src/views/youView.js',
  './src/xlsx.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  // Server-status checks must always reach the real server; answering them
  // from the cache would show LIVE while the server is down.
  if (url.pathname.endsWith('/__health') || url.pathname.endsWith('/__ws')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
      )
  );
});

// ---- notifications: tapping a reminder or one of its buttons ----
// "Didn't spend" marks the meal as handled for today straight in the app's
// database (no need to open Oracle). Anything else opens / focuses Oracle and
// tells it what to do ("log" opens the new-expense form).
function markMealSkipped(meal) {
  return new Promise((resolve) => {
    const open = indexedDB.open('orbit-db');
    open.onerror = () => resolve();
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains('kv')) return resolve();
      const tx = db.transaction('kv', 'readwrite');
      const store = tx.objectStore('kv');
      const get = store.get('notifLog');
      get.onsuccess = () => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const log = get.result && get.result.date === today ? get.result : { date: today, sent: [], skipped: [] };
        if (!log.skipped.includes(meal)) log.skipped.push(meal);
        store.put(log, 'notifLog');
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
  });
}

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  if (event.action === 'skip' && data.meal) {
    event.waitUntil(markMealSkipped(data.meal));
    return;
  }
  const message = { type: 'oracle-notification', data: { ...data, action: event.action || data.action } };
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => c.url.startsWith(self.registration.scope));
      if (client) {
        client.postMessage(message);
        return client.focus();
      }
      const params = new URLSearchParams({ notify: message.data.action || 'open' });
      if (data.meal) params.set('meal', data.meal);
      if (data.view) params.set('view', data.view);
      return self.clients.openWindow(`./?${params}#home`);
    })
  );
});
