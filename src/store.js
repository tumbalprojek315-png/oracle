import * as db from './db.js';
import { locale } from './i18n.js';
import { mealBucket, MEAL_BUCKETS } from './mealTime.js';

// Starting categories for a new device; after that the list in settings is
// the source of truth (every category can be renamed or deleted).
export const DEFAULT_PAYMENT_METHODS = ['Cash', 'OCBC FRANK', 'EZ-Link', 'MyBCA'];

export const DEFAULT_CATEGORIES = {
  food: ['Eating Out', 'Groceries', 'Drinks & Snacks'],
  non_food: ['Transportation', 'Dorm Essentials', 'Shopping', 'Health', 'Entertainment', 'Education'],
  fixed: ['Rent/Accommodation', 'Utilities', 'Phone/Data', 'Subscription', 'Insurance'],
};

// ---- state ----
// `all` includes tombstones (deleted entries keep a `deletedAt` so a delete on
// the phone also removes the entry on the laptop after the next sync).
// `live` is what every screen sees.
let all = [];
let live = [];
const listeners = new Set();

const DEFAULT_SETTINGS = {
  currency: 'SGD',
  monthlyBudget: 0,
  name: '', // shown in the greeting and the You tab
  language: 'auto', // 'auto' (follow the device) | 'en' | 'id'
  textSize: 'default', // 'small' | 'default' | 'large'
  onboarded: false,
  notifications: null, // see notifications.js (DEFAULT_NOTIFICATIONS)
  countedTypes: ['food', 'non_food', 'fixed'], // which types totals, budget and Insights count
  theme: 'auto',
  categories: null, // { food: [...], non_food: [...], fixed: [...] }, filled on first run
  categoriesUpdatedAt: null,
  paymentMethods: null, // filled on first run; every one can be renamed or deleted
  paymentMethodsUpdatedAt: null,
  excludedLocations: [],
  excludedItemNames: [],
  deviceId: null,
  deviceName: '',
  lastExportAt: null,
  lastImportAt: null,
  settingsUpdatedAt: null,
};
let settings = structuredClone(DEFAULT_SETTINGS);
const settingsListeners = new Set();

function recompute() {
  live = all.filter((e) => !e.deletedAt);
}

function emit() {
  for (const fn of listeners) fn(live);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function subscribeSettings(fn) {
  settingsListeners.add(fn);
  return () => settingsListeners.delete(fn);
}

function guessDeviceName() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android phone';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Windows/i.test(ua)) return 'Windows laptop';
  if (/Mac/i.test(ua)) return 'Mac';
  return 'This device';
}

export async function init() {
  const [entries, saved] = await Promise.all([db.getAllEntries(), db.kvGet('settings')]);
  all = entries;
  recompute();
  settings = { ...structuredClone(DEFAULT_SETTINGS), ...(saved || {}) };
  settings.currency = 'SGD';
  if (!settings.categories) {
    // First run, or upgrading from the version with fixed built-ins plus
    // "custom" extras: start from the defaults and keep the extras.
    const old = settings.customCategories || {};
    settings.categories = {};
    for (const t of Object.keys(DEFAULT_CATEGORIES)) {
      settings.categories[t] = [...new Set([...DEFAULT_CATEGORIES[t], ...(old[t] || [])])];
    }
    delete settings.customCategories;
    await db.kvSet('settings', settings);
  }
  if (!settings.paymentMethods) {
    // Upgrade from fixed built-ins + "custom" extras to one editable list.
    settings.paymentMethods = [...new Set([...DEFAULT_PAYMENT_METHODS, ...(settings.customPaymentMethods || [])])];
    delete settings.customPaymentMethods;
    await db.kvSet('settings', settings);
  }
  if (!settings.deviceId) {
    settings.deviceId = crypto.randomUUID();
    settings.deviceName = guessDeviceName();
    await db.kvSet('settings', settings);
  }
}

// ---- settings ----

export function getSettings() {
  return settings;
}

export async function updateSettings(patch, { touch = true } = {}) {
  settings = { ...settings, ...patch };
  if (touch) settings.settingsUpdatedAt = new Date().toISOString();
  await db.kvSet('settings', settings);
  for (const fn of settingsListeners) fn(settings);
  emit(); // currency/categories affect how entries render
}

function categoryList(type) {
  return [...((settings.categories || {})[type] || [])];
}

async function setCategoryList(type, list) {
  await updateSettings({ categories: { ...settings.categories, [type]: list }, categoriesUpdatedAt: new Date().toISOString() });
}

function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Returns an error message, or null when added.
export async function addCategory(type, name) {
  const clean = name.trim();
  if (!clean) return 'Type a name first.';
  if (categoryList(type).some((c) => sameName(c, clean))) return `“${clean}” already exists.`;
  await setCategoryList(type, [...categoryList(type), clean]);
  return null;
}

export function countCategoryEntries(type, name) {
  const list = live.filter((e) => e.type === type && e.category === name);
  return { count: list.length, total: list.reduce((s, e) => s + e.amount, 0) };
}

// Renames the category and every entry already logged under it. Returns an
// error message, or null when done.
export async function renameCategory(type, oldName, newName) {
  const clean = newName.trim();
  if (!clean) return 'The name can’t be empty.';
  if (clean === oldName) return null;
  if (categoryList(type).some((c) => c !== oldName && sameName(c, clean))) return `“${clean}” already exists.`;
  await setCategoryList(type, categoryList(type).map((c) => (c === oldName ? clean : c)));
  const now = new Date().toISOString();
  const changed = all.filter((e) => e.type === type && e.category === oldName && !e.deletedAt).map((e) => ({ ...e, category: clean, updatedAt: now }));
  if (changed.length) {
    await db.putEntries(changed);
    const byId = new Map(changed.map((e) => [e.id, e]));
    all = all.map((e) => byId.get(e.id) || e);
    recompute();
    emit();
  }
  return null;
}

// Deletes the category AND every entry logged under it (the caller warns
// first). Returns what's needed to undo.
export async function deleteCategory(type, name) {
  const list = categoryList(type);
  const index = list.indexOf(name);
  await setCategoryList(type, list.filter((c) => c !== name));
  const removed = await removeEntries(live.filter((e) => e.type === type && e.category === name).map((e) => e.id));
  return { type, name, index, removed };
}

export async function undoDeleteCategory({ type, name, index, removed }) {
  const list = categoryList(type).filter((c) => c !== name);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, name);
  await setCategoryList(type, list);
  if (removed.length) await restoreEntries(removed);
}

async function setPaymentMethods(list) {
  await updateSettings({ paymentMethods: list, paymentMethodsUpdatedAt: new Date().toISOString() });
}

// Returns an error message, or null when added.
export async function addPaymentMethod(name) {
  const clean = name.trim();
  if (!clean) return 'Type a name first.';
  if (settings.paymentMethods.some((p) => sameName(p, clean))) return `“${clean}” already exists.`;
  await setPaymentMethods([...settings.paymentMethods, clean]);
  return null;
}

export function countPaymentEntries(name) {
  const list = live.filter((e) => e.paymentMethod === name);
  return { count: list.length, total: list.reduce((s, e) => s + e.amount, 0) };
}

// Renames the method and every entry paid with it. Error message or null.
export async function renamePaymentMethod(oldName, newName) {
  const clean = newName.trim();
  if (!clean) return 'The name can’t be empty.';
  if (clean === oldName) return null;
  if (settings.paymentMethods.some((p) => p !== oldName && sameName(p, clean))) return `“${clean}” already exists.`;
  await setPaymentMethods(settings.paymentMethods.map((p) => (p === oldName ? clean : p)));
  const now = new Date().toISOString();
  const changed = all.filter((e) => e.paymentMethod === oldName && !e.deletedAt).map((e) => ({ ...e, paymentMethod: clean, updatedAt: now }));
  if (changed.length) {
    await db.putEntries(changed);
    const byId = new Map(changed.map((e) => [e.id, e]));
    all = all.map((e) => byId.get(e.id) || e);
    recompute();
    emit();
  }
  return null;
}

// Removes the option only; expenses already paid with it keep their record.
export async function deletePaymentMethod(name) {
  const index = settings.paymentMethods.indexOf(name);
  await setPaymentMethods(settings.paymentMethods.filter((p) => p !== name));
  return { name, index };
}

export async function undoDeletePaymentMethod({ name, index }) {
  const list = settings.paymentMethods.filter((p) => p !== name);
  list.splice(Math.max(0, Math.min(index, list.length)), 0, name);
  await setPaymentMethods(list);
}

export async function excludeLocationSuggestion(value) {
  await updateSettings({ excludedLocations: [...new Set([...settings.excludedLocations, value])] });
}

export async function excludeItemNameSuggestion(value) {
  await updateSettings({ excludedItemNames: [...new Set([...settings.excludedItemNames, value])] });
}

// Erase everything on this device: all expenses (no tombstones kept) and
// all settings except the device ID. Used by You → Delete all data.
export async function eraseAllData() {
  await db.deleteEntriesHard(all.map((e) => e.id));
  all = [];
  recompute();
  const keep = { deviceId: settings.deviceId, deviceName: settings.deviceName };
  settings = { ...structuredClone(DEFAULT_SETTINGS), ...keep, categories: structuredClone(DEFAULT_CATEGORIES), paymentMethods: [...DEFAULT_PAYMENT_METHODS] };
  await db.kvSet('settings', settings);
  await db.kvSet('notifLog', null);
  for (const fn of settingsListeners) fn(settings);
  emit();
}

// ---- entries ----

export function getEntries() {
  return live;
}

export function getAllIncludingDeleted() {
  return all;
}

export function getEntry(id) {
  return live.find((e) => e.id === id) || null;
}

function upsertLocal(record) {
  const idx = all.findIndex((e) => e.id === record.id);
  if (idx === -1) all = [...all, record];
  else all = all.map((e, i) => (i === idx ? record : e));
  recompute();
}

export async function saveEntry(input) {
  const now = new Date().toISOString();
  const existing = input.id ? all.find((e) => e.id === input.id) : null;
  const record = {
    ...input,
    id: input.id || crypto.randomUUID(),
    amount: Math.round(Number(input.amount) * 100) / 100,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.putEntries([record]);
  upsertLocal(record);
  emit();
  return record;
}

export async function removeEntry(id) {
  const existing = all.find((e) => e.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const tomb = { ...existing, deletedAt: now, updatedAt: now };
  await db.putEntries([tomb]);
  upsertLocal(tomb);
  emit();
  return existing;
}

// Bulk delete. Like removeEntry, entries become tombstones so the deletion
// also reaches other devices on the next sync.
export async function removeEntries(ids) {
  const wanted = new Set(ids);
  const now = new Date().toISOString();
  const removed = all.filter((e) => wanted.has(e.id) && !e.deletedAt);
  const tombs = removed.map((e) => ({ ...e, deletedAt: now, updatedAt: now }));
  await db.putEntries(tombs);
  const byId = new Map(tombs.map((t) => [t.id, t]));
  all = all.map((e) => byId.get(e.id) || e);
  recompute();
  emit();
  return removed;
}

export async function restoreEntries(list) {
  const now = new Date().toISOString();
  const restored = list.map((e) => ({ ...e, deletedAt: null, updatedAt: now }));
  await db.putEntries(restored);
  const byId = new Map(restored.map((r) => [r.id, r]));
  all = all.map((e) => byId.get(e.id) || e);
  recompute();
  emit();
}

export async function restoreEntry(entry) {
  const record = { ...entry, deletedAt: null, updatedAt: new Date().toISOString() };
  await db.putEntries([record]);
  upsertLocal(record);
  emit();
}

const CONTENT_FIELDS = ['amount', 'type', 'category', 'location', 'itemName', 'mealTime', 'transportFrom', 'transportTo', 'paymentMethod', 'date', 'notes'];

function sameContent(a, b) {
  return CONTENT_FIELDS.every((f) => (f === 'amount' ? Math.abs((a.amount || 0) - (b.amount || 0)) < 0.005 : (a[f] || '') === (b[f] || '')));
}

// Work out what importing `incoming` would do, without writing anything.
//   timestamps: true  → a sync file: same id, the newer `updatedAt` wins
//                       (deletions included).
//   timestamps: false → an Excel/CSV table: it has no edit times, so a row
//                       that differs from this device counts as an edit made
//                       in the spreadsheet.
// Either way, entries that are alive in the file but deleted on this device
// are listed in `deletedHere` so the person can choose to bring them back
// (restoring a backup) instead of silently skipping them.
export function planMerge(incoming, { timestamps = true } = {}) {
  const byId = new Map(all.map((e) => [e.id, e]));
  const now = new Date().toISOString();
  const plan = { add: [], update: [], remove: [], deletedHere: [], unchanged: 0 };
  const seen = new Set();
  for (const raw of incoming) {
    if (seen.has(raw.id)) continue; // duplicate row in the file
    seen.add(raw.id);
    const cur = byId.get(raw.id);
    const e = timestamps ? raw : { ...raw, createdAt: cur?.createdAt || raw.createdAt || now, updatedAt: now, deletedAt: null };
    if (!cur) {
      if (e.deletedAt) plan.unchanged++;
      else plan.add.push(e);
      continue;
    }
    if (cur.deletedAt && !e.deletedAt) {
      if (timestamps && (e.updatedAt || '') > (cur.updatedAt || '')) plan.update.push(e);
      else plan.deletedHere.push({ ...e, deletedAt: null, updatedAt: now });
      continue;
    }
    if (timestamps) {
      if ((e.updatedAt || '') > (cur.updatedAt || '')) (e.deletedAt ? plan.remove : plan.update).push(e);
      else plan.unchanged++;
    } else if (sameContent(cur, e)) plan.unchanged++;
    else plan.update.push(e);
  }
  return plan;
}

export async function applyMerge(plan, { restoreDeleted = false } = {}) {
  const changed = [...plan.add, ...plan.update, ...plan.remove, ...(restoreDeleted ? plan.deletedHere : [])];
  await db.putEntries(changed);
  const byId = new Map(all.map((e) => [e.id, e]));
  for (const e of changed) byId.set(e.id, e);
  all = [...byId.values()];
  recompute();
  emit();
  return {
    added: plan.add.length,
    updated: plan.update.length,
    removed: plan.remove.length,
    restored: restoreDeleted ? plan.deletedHere.length : 0,
    skippedDeleted: restoreDeleted ? 0 : plan.deletedHere.length,
    unchanged: plan.unchanged,
  };
}

// Merge a sync file from another device (newer `updatedAt` wins). Importing
// the same file twice changes nothing.
export async function mergeEntries(incoming, opts = {}) {
  return applyMerge(planMerge(incoming, opts), opts);
}

function mergedPaymentMethods(incoming) {
  if (incoming.paymentMethods && (incoming.paymentMethodsUpdatedAt || '') > (settings.paymentMethodsUpdatedAt || '')) {
    return { paymentMethods: [...incoming.paymentMethods], paymentMethodsUpdatedAt: incoming.paymentMethodsUpdatedAt };
  }
  return { paymentMethods: [...new Set([...settings.paymentMethods, ...(incoming.customPaymentMethods || [])])] };
}

export async function mergeSettings(incoming) {
  if (!incoming) return;
  // Categories: the device that edited its list last wins (so renames and
  // deletions carry over). Files from older versions only add categories.
  let categories = structuredClone(settings.categories);
  let categoriesUpdatedAt = settings.categoriesUpdatedAt;
  if (incoming.categories && (incoming.categoriesUpdatedAt || '') > (settings.categoriesUpdatedAt || '')) {
    categories = structuredClone(incoming.categories);
    categoriesUpdatedAt = incoming.categoriesUpdatedAt;
  } else if (incoming.customCategories) {
    for (const t of Object.keys(incoming.customCategories)) {
      categories[t] = [...new Set([...(categories[t] || []), ...(incoming.customCategories[t] || [])])];
    }
  }
  const patch = {
    categories,
    categoriesUpdatedAt,
    ...mergedPaymentMethods(incoming),
    excludedLocations: [...new Set([...settings.excludedLocations, ...(incoming.excludedLocations || [])])],
    excludedItemNames: [...new Set([...settings.excludedItemNames, ...(incoming.excludedItemNames || [])])],
  };
  // Scalar preferences: whichever device changed them last wins.
  if ((incoming.settingsUpdatedAt || '') > (settings.settingsUpdatedAt || '')) {
    if (Number.isFinite(incoming.monthlyBudget)) patch.monthlyBudget = incoming.monthlyBudget;
    patch.settingsUpdatedAt = incoming.settingsUpdatedAt;
  }
  await updateSettings(patch, { touch: false });
}

// ---- derived aggregates (pure functions over an entries array) ----

export function sumAmount(list) {
  return list.reduce((s, e) => s + e.amount, 0);
}

export function sumByKey(list, keyFn) {
  const map = new Map();
  for (const e of list) {
    const k = keyFn(e);
    map.set(k, (map.get(k) || 0) + e.amount);
  }
  return map;
}

export function valueStats(list, keyFn) {
  const map = new Map();
  for (const e of list) {
    const k = keyFn(e);
    if (!k) continue;
    const cur = map.get(k) || { count: 0, sum: 0, lastUsedAt: e.date };
    cur.count += 1;
    cur.sum += e.amount;
    if (e.date > cur.lastUsedAt) cur.lastUsedAt = e.date;
    map.set(k, cur);
  }
  return map;
}

// Ranked for input suggestions: frequency blended with recency.
export function topByRecencyFrequency(list, keyFn, limit = 5) {
  const stats = valueStats(list, keyFn);
  const today = new Date();
  const scored = [...stats.entries()].map(([name, s]) => {
    const days = Math.max(0, (today - new Date(s.lastUsedAt + 'T00:00:00')) / 86400000);
    return { name, score: s.count / (1 + days / 7) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.name);
}

export function allDistinctValues(list, keyFn) {
  return [...valueStats(list, keyFn).keys()].sort((a, b) => a.localeCompare(b));
}

// Free-typed text drifts in casing ("Nasi Lemak" / "nasi lemak"): group
// case-insensitively, display the most recent spelling.
export function topTextByFrequency(list, field, limit = 8) {
  const map = new Map();
  for (const e of list) {
    const raw = (e[field] || '').trim();
    if (!raw) continue;
    const norm = raw.toLowerCase();
    const cur = map.get(norm) || { display: raw, count: 0, sum: 0, lastUsedAt: e.date };
    cur.count += 1;
    cur.sum += e.amount;
    if (e.date >= cur.lastUsedAt) {
      cur.lastUsedAt = e.date;
      cur.display = raw;
    }
    map.set(norm, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.sum - a.sum || b.count - a.count)
    .slice(0, limit)
    .map((v) => ({ name: v.display, count: v.count, sum: v.sum }));
}

export function lastPaymentMethodFor(list, predicate) {
  let best = null;
  for (const e of list) {
    if (!e.paymentMethod || !predicate(e)) continue;
    if (!best || e.date > best.date || (e.date === best.date && (e.createdAt || '') > (best.createdAt || ''))) best = e;
  }
  return best ? best.paymentMethod : null;
}

export function mealBucketStats(list) {
  const stats = new Map(MEAL_BUCKETS.map((b) => [b.key, { count: 0, sum: 0 }]));
  for (const e of list) {
    const bucket = mealBucket(e.mealTime);
    if (!bucket) continue;
    const cur = stats.get(bucket);
    cur.count += 1;
    cur.sum += e.amount;
  }
  return stats;
}

export function trendByMonth(list, monthsBack = 6) {
  const now = new Date();
  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString(locale(), { month: 'short' });
    months.push({ key, label, value: 0 });
  }
  const byMonth = new Map(months.map((m) => [m.key, m]));
  for (const e of list) {
    const m = byMonth.get(e.date.slice(0, 7));
    if (m) m.value += e.amount;
  }
  return months;
}

export function dailyTotals(list, start, end) {
  const days = [];
  const d = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  const map = sumByKey(list, (e) => e.date);
  while (d <= last) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({ date: iso, value: map.get(iso) || 0 });
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Average spend per weekday (Mon..Sun), counting days with zero spend too,
// so "you spend most on Fridays" isn't skewed by how many Fridays you logged.
export function weekdayAverages(list, start, end) {
  const daily = dailyTotals(list, start, end);
  const buckets = Array.from({ length: 7 }, () => ({ sum: 0, days: 0 }));
  for (const d of daily) {
    const wd = (new Date(d.date + 'T00:00:00').getDay() + 6) % 7;
    buckets[wd].sum += d.value;
    buckets[wd].days += 1;
  }
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return buckets.map((b, i) => ({ label: labels[i], value: b.days ? b.sum / b.days : 0 }));
}
