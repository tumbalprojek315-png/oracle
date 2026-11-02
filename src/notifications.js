// Smart reminders.
//
// Meal reminders use the time you usually eat breakfast, lunch and dinner
// (set by you, in 30-minute steps; meals you skip can be turned off) and
// remind you an hour later if nothing has been logged for that meal today.
// Oracle also suggests each time from your own logs (the half-hour you most
// often eat). A daily check-in can remind you in the evening. Everything is
// computed on this device.
//
// Delivery:
//   • Native app (Capacitor LocalNotifications, when published to the App
//     Store): reminders are scheduled with the phone's system, so they arrive
//     even when Oracle is closed. Logging a meal cancels that day's reminder.
//   • Web / installed PWA: reminders are shown while Oracle is open or running
//     in the background (browsers can't schedule local notifications for a
//     closed web app without a push server).
//
// Notifications never show amounts unless the person turns that on (App
// Store guideline 4.5.4: no sensitive information on the lock screen).
import { getEntries, getSettings, updateSettings, subscribe, subscribeSettings } from './store.js';
import { kvGet, kvSet } from './db.js';
import { mealBucket } from './mealTime.js';
import { todayISO, formatCurrency } from './format.js';
import { t, tn } from './i18n.js';

// from/to: the times offered in the picker (every 30 minutes) and the window
// used to read your usual time from your logs. Until you pick a time, each
// meal starts at its first option (fallback).
export const REMINDER_MEALS = [
  { key: 'pagi', label: 'Breakfast', fallback: 5 * 60, from: 5 * 60, to: 11 * 60 },
  { key: 'siang', label: 'Lunch', fallback: 11 * 60, from: 11 * 60, to: 15 * 60 + 30 },
  { key: 'malam', label: 'Dinner', fallback: 16 * 60, from: 16 * 60, to: 23 * 60 },
];

export const DEFAULT_NOTIFICATIONS = {
  enabled: false,
  meals: { pagi: true, siang: true, malam: true }, // false = "I usually skip this meal"
  mealTimes: { pagi: null, siang: null, malam: null }, // 'HH:MM' set by you; null = suggestion or default
  dailySummary: true,
  summaryTime: '21:00',
  showAmounts: false,
};

const DELAY_AFTER_MEAL = 60; // minutes
const STALE_AFTER = 3 * 60; // don't send a reminder more than 3 h late
const CHECK_EVERY_MS = 30 * 1000;

export function notificationSettings() {
  const n = getSettings().notifications || {};
  return {
    ...DEFAULT_NOTIFICATIONS,
    ...n,
    meals: { ...DEFAULT_NOTIFICATIONS.meals, ...(n.meals || {}) },
    mealTimes: { ...DEFAULT_NOTIFICATIONS.mealTimes, ...(n.mealTimes || {}) },
  };
}

export async function updateNotificationSettings(patch) {
  await updateSettings({ notifications: { ...notificationSettings(), ...patch } }, { touch: false });
}

const pad = (n) => String(n).padStart(2, '0');
export const minutesToHHMM = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m) % 60)}`;
const hhmmToMinutes = (s) => {
  if (!s) return null; // not set ('' would otherwise read as 00:00)
  const [hh, mm] = String(s).split(':').map(Number);
  return Number.isFinite(hh) ? hh * 60 + (mm || 0) : null;
};
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

// The times offered for a meal: every 30 minutes in its window.
export function mealTimeOptions(key) {
  const m = REMINDER_MEALS.find((x) => x.key === key);
  const out = [];
  for (let v = m.from; v <= m.to; v += 30) out.push(minutesToHHMM(v));
  return out;
}

// When do you most often eat this meal? The meal times of your food entries
// (last 60 days) inside the meal's window, rounded to the half hour; the most
// common half hour wins (ties: the one nearest your average). Needs 3 meals.
const SUGGEST_MIN = 3;
export function mealSuggestion(key) {
  const m = REMINDER_MEALS.find((x) => x.key === key);
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const sinceISO = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}`;
  const times = getEntries()
    .filter((e) => e.type === 'food' && e.date >= sinceISO)
    .map((e) => hhmmToMinutes(e.mealTime))
    .filter((v) => v != null && v >= m.from - 15 && v <= m.to + 15);
  if (times.length < SUGGEST_MIN) return { time: null, count: times.length };
  const slots = new Map();
  for (const v of times) {
    const slot = Math.min(m.to, Math.max(m.from, Math.round(v / 30) * 30));
    slots.set(slot, (slots.get(slot) || 0) + 1);
  }
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const [best] = [...slots.entries()].sort((a, b) => b[1] - a[1] || Math.abs(a[0] - avg) - Math.abs(b[0] - avg));
  return { time: minutesToHHMM(best[0]), count: times.length, hits: best[1] };
}

// Per meal: the time you eat (yours, else the suggestion, else a default) and
// when its reminder is due.
export function reminderPlan() {
  const n = notificationSettings();
  return REMINDER_MEALS.map((m) => {
    const suggestion = mealSuggestion(m.key);
    const set = hhmmToMinutes(n.mealTimes[m.key]);
    const eat = set != null ? set : hhmmToMinutes(suggestion.time) ?? m.fallback;
    const at = eat + DELAY_AFTER_MEAL;
    return {
      ...m,
      enabled: !!n.meals[m.key],
      source: set != null ? 'set' : suggestion.time ? 'suggested' : 'default',
      suggestion,
      eat: minutesToHHMM(eat),
      eatMinutes: eat,
      at: minutesToHHMM(at),
      atMinutes: at,
    };
  });
}

// Logged this meal today? A food entry in the same meal bucket, or with a
// meal time within 90 minutes of when you said you eat it (a 14:30 lunch is
// still lunch).
function loggedMealToday(key, eatMinutes) {
  const today = todayISO();
  return getEntries().some((e) => {
    if (e.type !== 'food' || e.date !== today) return false;
    if (mealBucket(e.mealTime) === key) return true;
    const v = hhmmToMinutes(e.mealTime);
    return v != null && eatMinutes != null && Math.abs(v - eatMinutes) <= 90;
  });
}

// ---- per-day log of what was sent / skipped (kept in the app database, so
// the service worker can mark "Didn't spend" without opening the app) ----
async function readLog() {
  const log = (await kvGet('notifLog')) || {};
  return log.date === todayISO() ? log : { date: todayISO(), sent: [], skipped: [] };
}
async function writeLog(log) {
  await kvSet('notifLog', log);
}

export async function skipMealToday(key) {
  const log = await readLog();
  if (!log.skipped.includes(key)) log.skipped.push(key);
  await writeLog(log);
  reschedule();
}

// ---- platform ----
function nativePlugin() {
  const cap = window.Capacitor;
  return cap?.isNativePlatform?.() ? cap.Plugins?.LocalNotifications || null : null;
}

export function notificationSupport() {
  if (nativePlugin()) return 'native';
  if ('Notification' in window) return 'web';
  return 'unsupported';
}

export async function permissionState() {
  const native = nativePlugin();
  if (native) {
    const r = await native.checkPermissions();
    return r.display === 'granted' ? 'granted' : r.display === 'denied' ? 'denied' : 'default';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  const native = nativePlugin();
  if (native) {
    const r = await native.requestPermissions();
    return r.display === 'granted' ? 'granted' : 'denied';
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
}

async function show({ title, body, tag, data, actions }) {
  if ((await permissionState()) !== 'granted') return false;
  const options = { body, tag, data, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) {
      await reg.showNotification(title, { ...options, actions: actions || [] });
      return true;
    }
  } catch {
    /* fall back to a page notification */
  }
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      handleNotificationAction(data || {});
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

// ---- message texts (no amounts unless allowed) ----
function mealMessage(meal) {
  return {
    title: t(`Had ${meal.label.toLowerCase()} yet?`),
    body: t('You usually have {meal} around {time}. Spent anything? Log it in a few seconds.', { meal: t(meal.label).toLowerCase(), time: meal.eat }),
  };
}

function summaryMessage() {
  const today = getEntries().filter((e) => e.date === todayISO());
  if (!today.length) return { title: t('Nothing logged today'), body: t('Did you spend anything today? Add it before you forget.') };
  const total = today.reduce((s, e) => s + e.amount, 0);
  return {
    title: t('Today: {n} logged', { n: tn(today.length, 'expense', 'expenses') }),
    body: notificationSettings().showAmounts ? t('Total {amount}. Anything missing?', { amount: formatCurrency(total) }) : t('Tap to review your day. Anything missing?'),
  };
}

// The next reminder that will actually be sent (today if still due, else
// tomorrow), for the "Next reminder" line in settings.
export async function nextReminder() {
  const n = notificationSettings();
  if (!n.enabled) return null;
  const log = await readLog();
  const now = nowMinutes();
  const items = [];
  for (const m of reminderPlan()) {
    if (!m.enabled) continue;
    const handled = log.sent.includes(`meal-${m.key}`) || log.skipped.includes(m.key) || loggedMealToday(m.key, m.eatMinutes);
    items.push({ label: m.label, minutes: m.atMinutes, tomorrow: handled || m.atMinutes + STALE_AFTER < now });
  }
  const sAt = hhmmToMinutes(n.summaryTime);
  if (n.dailySummary && sAt != null) items.push({ label: 'Daily check-in', minutes: sAt, tomorrow: log.sent.includes('summary') || sAt + STALE_AFTER < now });
  if (!items.length) return null;
  items.sort((a, b) => a.tomorrow - b.tomorrow || a.minutes - b.minutes);
  const next = items[0];
  return { label: next.label, time: minutesToHHMM(next.minutes), tomorrow: next.tomorrow, overdue: !next.tomorrow && next.minutes < now };
}

// A sample lunch reminder. delayMs lets you minimise the browser first to
// check reminders also arrive while Oracle is in the background.
export async function sendTest(delayMs = 0) {
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  const plan = reminderPlan().find((m) => m.key === 'siang');
  const msg = mealMessage(plan);
  return show({ ...msg, tag: 'oracle-test', data: { action: 'log', meal: 'siang' }, actions: [{ action: 'log', title: t('Log it') }, { action: 'skip', title: t('Didn’t spend') }] });
}

// ---- web: check what is due (runs while the app is open / in background) ----
let checking = false;
async function checkDue() {
  if (checking || notificationSupport() !== 'web') return;
  const n = notificationSettings();
  if (!n.enabled || (await permissionState()) !== 'granted') return;
  checking = true;
  try {
    const log = await readLog();
    const now = nowMinutes();
    for (const meal of reminderPlan()) {
      const id = `meal-${meal.key}`;
      if (!meal.enabled || log.sent.includes(id) || log.skipped.includes(meal.key)) continue;
      if (now < meal.atMinutes || now > meal.atMinutes + STALE_AFTER) continue;
      if (loggedMealToday(meal.key, meal.eatMinutes)) continue;
      const ok = await show({
        ...mealMessage(meal),
        tag: `oracle-${id}`,
        data: { action: 'log', meal: meal.key },
        actions: [{ action: 'log', title: t('Log it') }, { action: 'skip', title: t('Didn’t spend') }],
      });
      if (ok) log.sent.push(id);
    }
    const sAt = hhmmToMinutes(n.summaryTime);
    if (n.dailySummary && sAt != null && !log.sent.includes('summary') && now >= sAt && now <= sAt + STALE_AFTER) {
      const ok = await show({ ...summaryMessage(), tag: 'oracle-summary', data: { action: 'open', view: 'activity' } });
      if (ok) log.sent.push('summary');
    }
    await writeLog(log);
  } finally {
    checking = false;
  }
}

// ---- native: schedule the next 3 days with the phone's system ----
async function scheduleNative() {
  const plugin = nativePlugin();
  if (!plugin) return;
  const pending = await plugin.getPending();
  if (pending.notifications?.length) await plugin.cancel({ notifications: pending.notifications.map((x) => ({ id: x.id })) });
  const n = notificationSettings();
  if (!n.enabled) return;
  const log = await readLog();
  const plan = reminderPlan();
  const items = [];
  for (let day = 0; day < 3; day++) {
    const base = new Date();
    base.setDate(base.getDate() + day);
    plan.forEach((meal, i) => {
      if (!meal.enabled) return;
      if (day === 0 && (loggedMealToday(meal.key, meal.eatMinutes) || log.skipped.includes(meal.key))) return;
      const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(meal.atMinutes / 60), meal.atMinutes % 60);
      if (at <= new Date()) return;
      items.push({ id: day * 10 + i + 1, schedule: { at }, ...mealMessage(meal), extra: { action: 'log', meal: meal.key }, actionTypeId: 'oracle-meal' });
    });
    const sAt = hhmmToMinutes(n.summaryTime);
    if (n.dailySummary && sAt != null) {
      const at = new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(sAt / 60), sAt % 60);
      if (at > new Date()) items.push({ id: day * 10 + 9, schedule: { at }, title: t('Daily check-in'), body: t('Anything you spent today that isn’t logged yet?'), extra: { action: 'open', view: 'activity' } });
    }
  }
  if (items.length) await plugin.schedule({ notifications: items });
}

// ---- tapping a notification (from the service worker, a page
// notification or the native plugin) ----
let actionHandler = () => {};
export function onNotificationAction(fn) {
  actionHandler = fn;
}
export async function handleNotificationAction(data) {
  if (data.action === 'skip' && data.meal) {
    await skipMealToday(data.meal);
    return;
  }
  actionHandler(data);
}

let rescheduleTimer = null;
export function reschedule() {
  clearTimeout(rescheduleTimer);
  rescheduleTimer = setTimeout(() => {
    if (notificationSupport() === 'native') scheduleNative();
    else checkDue();
  }, 300);
}

export function startNotifications() {
  const plugin = nativePlugin();
  if (plugin) {
    plugin.registerActionTypes?.({ types: [{ id: 'oracle-meal', actions: [{ id: 'log', title: t('Log it') }, { id: 'skip', title: t('Didn’t spend') }] }] });
    plugin.addListener?.('localNotificationActionPerformed', (e) => {
      const extra = e.notification?.extra || {};
      handleNotificationAction(e.actionId === 'skip' ? { action: 'skip', meal: extra.meal } : extra);
    });
  }
  navigator.serviceWorker?.addEventListener?.('message', (e) => {
    if (e.data?.type === 'oracle-notification') handleNotificationAction(e.data.data || {});
  });
  subscribe(reschedule); // logging a meal cancels / suppresses its reminder
  subscribeSettings(reschedule);
  document.addEventListener('visibilitychange', reschedule);
  setInterval(() => notificationSupport() === 'web' && checkDue(), CHECK_EVERY_MS);
  reschedule();
}
