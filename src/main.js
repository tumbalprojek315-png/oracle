import * as store from './store.js';
import { requestPersistence } from './db.js';
import { createHomeView } from './views/homeView.js';
import { createActivityView } from './views/activityView.js';
import { createInsightsView } from './views/insightsView.js';
import { createYouView } from './views/youView.js';
import { importSyncFile } from './views/syncView.js';
import { openOnboarding } from './views/onboarding.js';
import { openAddSheet } from './entryActions.js';
import { isSheetOpen } from './components/sheet.js';
import { h } from './dom.js';
import { startServerStatus } from './serverStatus.js';
import { startNotifications, onNotificationAction } from './notifications.js';
import { t, lang, translateStatic, startAutoTranslate } from './i18n.js';

const VIEWS = ['home', 'activity', 'insights', 'you'];
const TEXT_SCALE = { small: 0.92, default: 1, large: 1.12, xlarge: 1.12 };

function isDark() {
  const theme = store.getSettings().theme || 'auto';
  return theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

// Theme, text size and language: applied at start and whenever settings change.
// A new language reloads the app: every screen is then built in it (screens
// already on show would otherwise keep the old language until a restart).
let shownLang = null;
function applyPreferences() {
  const s = store.getSettings();
  if (shownLang && lang() !== shownLang) {
    location.reload();
    return;
  }
  shownLang = lang();
  const theme = s.theme || 'auto';
  if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark() ? '#060a13' : '#dfe5ee');
  // Scales everything (text, spacing, touch targets) together, like the
  // system's text-size setting, and keeps the layout inside the screen.
  document.body.style.zoom = String(TEXT_SCALE[s.textSize] || 1);
  translateStatic();
}

function renderFatal(err) {
  const root = document.getElementById('view-root');
  root.replaceChildren(
    h('div', { class: 'view' }, [
      h('div', { class: 'glass card' }, [
        h('h2', { class: 'card-title' }, t('Oracle couldn’t start')),
        h('p', { class: 'hint' }, err?.message || String(err)),
        h('p', { class: 'hint' }, t('This usually means the browser blocks storage (private mode). Open it in a normal window.')),
      ]),
    ])
  );
}

async function main() {
  try {
    await store.init();
  } catch (err) {
    renderFatal(err);
    return;
  }
  startAutoTranslate(document.body);
  applyPreferences();
  store.subscribeSettings(applyPreferences);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPreferences);
  requestPersistence();

  const viewRoot = document.getElementById('view-root');
  const navButtons = [...document.querySelectorAll('[data-view]')];

  const views = {
    home: createHomeView({ navigate: (v) => go(v) }),
    activity: createActivityView(),
    insights: createInsightsView(),
    you: createYouView({ navigate: (route) => go(route) }),
  };
  for (const key of VIEWS) {
    views[key].root.hidden = true;
    viewRoot.appendChild(views[key].root);
  }

  // Routes: #home, #activity, #insights, #you, #you/notifications …
  let current = null;
  function activate(route, { push = true } = {}) {
    let [name, sub] = String(route || '').split('/');
    if (!views[name]) name = 'home';
    const target = sub ? `${name}/${sub}` : name;
    if (target === current) return;
    const sameTab = current && current.split('/')[0] === name;
    current = target;
    for (const key of VIEWS) {
      const on = key === name;
      views[key].root.hidden = !on;
      if (on) views[key].activate(sub);
      else if (!sameTab) views[key].deactivate();
    }
    for (const btn of navButtons) {
      const on = btn.dataset.view === name;
      btn.classList.toggle('is-active', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
    if (push && location.hash !== '#' + target) history.pushState(null, '', '#' + target);
    window.scrollTo({ top: 0 });
  }
  const go = (route) => activate(route);

  for (const btn of navButtons) btn.addEventListener('click', () => activate(btn.dataset.view));
  document.getElementById('addBtn').addEventListener('click', () => openAddSheet());
  window.addEventListener('popstate', () => {
    current = null; // let the You tab follow its own sub-page history
    activate(location.hash.slice(1), { push: false });
  });

  // Old links: #v=dashboard&s=<token> (Ledger) and #sync (before the You tab).
  const legacyView = { input: 'home', history: 'activity', dashboard: 'insights', food: 'insights', sync: 'you/sync' };
  const hash = location.hash.slice(1);
  const oldV = new URLSearchParams(hash).get('v');
  const start = legacyView[hash] || (VIEWS.includes(hash.split('/')[0]) ? hash : legacyView[oldV] || 'home');
  activate(start, { push: false });
  if (location.hash !== '#' + current) history.replaceState(null, '', '#' + current);

  // Keyboard: "n" = new expense (laptop).
  document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (isSheetOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      openAddSheet();
    }
  });

  // Drop a sync file anywhere to import it.
  const dropHint = document.getElementById('drop-hint');
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
    dragDepth++;
    dropHint.hidden = false;
  });
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropHint.hidden = true;
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropHint.hidden = true;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    activate('you/sync');
    await importSyncFile(file);
  });

  startServerStatus(document.getElementById('serverStatus'));

  // Tapping a reminder: "log" opens the new-expense form for that meal.
  const handleNotification = (data) => {
    if (data.action === 'log') {
      activate('home');
      openAddSheet({ type: 'food' });
    } else if (data.view) activate(data.view);
  };
  onNotificationAction(handleNotification);
  startNotifications();
  // Opened from a notification while the app was closed (?notify=log&meal=…).
  const params = new URLSearchParams(location.search);
  if (params.get('notify')) {
    handleNotification({ action: params.get('notify'), meal: params.get('meal'), view: params.get('view') });
    history.replaceState(null, '', location.pathname + location.hash);
  }

  document.body.classList.add('is-ready');

  // First launch: full-screen setup (language, name, theme, reminders).
  if (!store.getSettings().onboarded) openOnboarding();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

main();
