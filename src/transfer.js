// Moving data between devices without internet, and exporting it for
// analysis. Three outputs:
//   • Sync file (.json)  — everything, incl. deletions + settings. Import it on
//                          the other device; merging is by id, so it's safe
//                          to import the same file again.
//   • Excel (.xlsx)       — tidy tables for analysis (Transactions, Monthly,
//                          Categories, Daily).
//   • CSV                 — the Transactions table only, for any tool.
import { typeLabel, TYPES, typeOfCategory } from './categories.js';
import { getSettings } from './store.js';
import { mealBucket, mealBucketLabel } from './mealTime.js';
import { buildXlsx, readXlsx } from './xlsx.js';

export const SYNC_KIND = 'oracle-sync';
const SYNC_KINDS = [SYNC_KIND, 'orbit-sync']; // files from before the rename still import

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ---- deliver a file: share sheet (Quick Share / Bluetooth / AirDrop, works
// offline) when the device supports sharing it, otherwise a download ----

export function canShareFiles() {
  try {
    const probe = new File(['x'], 'probe.txt', { type: 'text/plain' });
    return !!navigator.canShare && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Returns 'shared' | 'downloaded' | 'cancelled'.
export async function deliver(blob, filename, { preferShare = true } = {}) {
  if (preferShare && navigator.canShare) {
    // Android only shares certain MIME types; retry as text/plain for JSON/CSV.
    const candidates = [new File([blob], filename, { type: blob.type })];
    if (/json|csv/.test(blob.type)) candidates.push(new File([blob], filename, { type: 'text/plain' }));
    for (const file of candidates) {
      let ok = false;
      try {
        ok = navigator.canShare({ files: [file] });
      } catch {
        ok = false;
      }
      if (!ok) continue;
      try {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled';
        break; // share failed for another reason → fall back to download
      }
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

// ---- sync file ----

export function buildSyncFile(allEntries) {
  const s = getSettings();
  const payload = {
    app: 'oracle',
    kind: SYNC_KIND,
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    device: { id: s.deviceId, name: s.deviceName },
    count: allEntries.filter((e) => !e.deletedAt).length,
    settings: {
      monthlyBudget: s.monthlyBudget,
      categories: s.categories,
      categoriesUpdatedAt: s.categoriesUpdatedAt,
      paymentMethods: s.paymentMethods,
      paymentMethodsUpdatedAt: s.paymentMethodsUpdatedAt,
      excludedLocations: s.excludedLocations,
      excludedItemNames: s.excludedItemNames,
      settingsUpdatedAt: s.settingsUpdatedAt,
    },
    entries: allEntries,
  };
  const safeName = (s.deviceName || 'device').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    blob: new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' }),
    filename: `oracle-sync_${safeName}_${stamp()}.json`,
  };
}

// Stable id for entries that come from the old app's exports (which had no
// id in the file). Same entry → same id, so re-importing never duplicates.
function fingerprintId(e) {
  const key = [e.date, Number(e.amount).toFixed(2), e.type, e.category, e.location || '', e.itemName || '', e.createdAt || '', e.notes || ''].join('|');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return `legacy-${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export function normalizeEntry(e, index = 0) {
  const amount = Number(e.amount);
  if (!Number.isFinite(amount) || (amount <= 0 && !e.deletedAt)) throw new Error(`Entry ${index + 1}: invalid amount.`);
  if (!e.type || !e.category || !/^\d{4}-\d{2}-\d{2}$/.test(String(e.date || ''))) {
    throw new Error(`Entry ${index + 1}: missing type, category or date.`);
  }
  const now = new Date().toISOString();
  const str = (v) => (v == null ? '' : String(v));
  const out = {
    id: e.id ? String(e.id) : fingerprintId(e),
    amount: Math.round(amount * 100) / 100,
    type: str(e.type),
    category: str(e.category),
    location: str(e.location),
    itemName: str(e.itemName),
    mealTime: str(e.mealTime),
    transportFrom: str(e.transportFrom),
    transportTo: str(e.transportTo),
    paymentMethod: str(e.paymentMethod),
    date: str(e.date),
    notes: str(e.notes),
    createdAt: e.createdAt || now,
    updatedAt: e.updatedAt || e.createdAt || now,
    deletedAt: e.deletedAt || null,
  };
  return out;
}

// Accepts an Oracle sync file, or an export from the old "Ledger" version.
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't valid JSON. Pick the oracle-sync .json file exported from the other device.");
  }
  const list = Array.isArray(data) ? data : data.entries;
  if (!Array.isArray(list)) throw new Error('No entries found in this file.');
  return {
    entries: list.map(normalizeEntry),
    settings: SYNC_KINDS.includes(data.kind) ? data.settings : null,
    device: data.device || null,
    exportedAt: data.exportedAt || null,
  };
}

// ---- importing any exported file: sync .json, Excel .xlsx or .csv ----

const HEADER_MAP = {
  date: 'date',
  type: 'type',
  category: 'category',
  amount: 'amount',
  paymentmethod: 'paymentMethod',
  payment: 'paymentMethod',
  paidwith: 'paymentMethod',
  location: 'location',
  place: 'location',
  item: 'itemName',
  itemname: 'itemName',
  mealtime: 'mealTime',
  from: 'transportFrom',
  to: 'transportTo',
  notes: 'notes',
  note: 'notes',
  entryid: 'id',
  id: 'id',
};

function headerKey(h) {
  const k = String(h || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
  if (k.startsWith('amount')) return 'amount';
  return HEADER_MAP[k] || null;
}

function toISODate(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s); // day first (SG / ID style)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

function toHHMM(v) {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const mins = Math.round((v % 1) * 1440);
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v || '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

// Handles both number styles: "1,234.50" (SG/US) and "1.234,50" (ID/EU).
// When both separators appear, the last one is the decimal point; a lone
// separator followed by exactly 3 digits is a thousands separator.
function toAmount(v) {
  if (typeof v === 'number') return v;
  let s = String(v || '').replace(/[^0-9.,-]/g, '');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot > -1 && lastComma > -1) {
    const dec = lastDot > lastComma ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(dec, '.');
  } else if (lastComma > -1 || lastDot > -1) {
    const sep = lastComma > -1 ? ',' : '.';
    const parts = s.split(sep);
    s = parts.length > 2 || parts[parts.length - 1].length === 3 ? parts.join('') : parts.join('.');
  }
  return Number(s);
}

function toTypeKey(v, category) {
  const s = String(v || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const byLabel = TYPES.find((t) => t.label.toLowerCase().replace(/[^a-z]/g, '') === s || t.key.replace(/_/g, '') === s);
  if (byLabel) return byLabel.key;
  return typeOfCategory(category);
}

// rows[0] = header row. Returns { entries, skipped: [{ row, reason }] }.
function entriesFromTable(rows) {
  const headerRow = rows.findIndex((r) => r && r.map(headerKey).includes('date') && r.map(headerKey).includes('amount'));
  if (headerRow < 0) throw new Error('No Date and Amount columns found. Use a file exported from this app (Transactions sheet).');
  const keys = rows[headerRow].map(headerKey);
  const entries = [];
  const skipped = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    if (!r.some((v) => String(v ?? '').trim() !== '')) continue;
    const rec = {};
    keys.forEach((k, c) => {
      if (k && rec[k] === undefined) rec[k] = r[c] ?? '';
    });
    const category = String(rec.category || '').trim();
    const raw = {
      id: String(rec.id || '').trim() || undefined,
      date: toISODate(rec.date),
      amount: toAmount(rec.amount),
      type: toTypeKey(rec.type, category),
      category,
      paymentMethod: String(rec.paymentMethod ?? '').trim(),
      location: String(rec.location ?? '').trim(),
      itemName: String(rec.itemName ?? '').trim(),
      mealTime: toHHMM(rec.mealTime),
      transportFrom: String(rec.transportFrom ?? '').trim(),
      transportTo: String(rec.transportTo ?? '').trim(),
      notes: String(rec.notes ?? '').trim(),
    };
    try {
      entries.push(normalizeEntry(raw, i));
    } catch (err) {
      const why = !raw.date ? 'date missing or not readable' : !(raw.amount > 0) ? 'amount missing or zero' : !raw.type ? 'unknown type' : 'category missing';
      skipped.push({ row: i + 1, reason: why });
    }
  }
  return { entries, skipped };
}

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes, BOM.
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const delim = (text.split(/\r?\n/)[0].match(/;/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Reads any file this app exports. `timestamps` tells the merge whether the
// file carries edit times (sync file) or is a table (Excel / CSV).
export async function parseImportFile(file) {
  const name = (file.name || '').toLowerCase();
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (isZip || name.endsWith('.xlsx')) {
    if (!isZip) throw new Error('This .xlsx file is damaged or not really an Excel file.');
    const sheets = await readXlsx(file);
    const sheet =
      sheets.find((s) => s.name.toLowerCase() === 'transactions') ||
      sheets.find((s) => s.rows.some((r) => r.map(headerKey).includes('date') && r.map(headerKey).includes('amount')));
    if (!sheet) throw new Error('No Transactions sheet found in this workbook.');
    return { ...entriesFromTable(sheet.rows), kind: 'excel', timestamps: false };
  }
  const text = await file.text();
  const trimmed = text.replace(/^﻿/, '').trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { ...parseImport(text), skipped: [], kind: 'sync', timestamps: true };
  }
  if (name.endsWith('.csv') || name.endsWith('.txt') || trimmed.includes(',')) {
    return { ...entriesFromTable(parseCsv(text)), kind: 'csv', timestamps: false };
  }
  throw new Error('Unsupported file. Choose a .json sync file, an .xlsx workbook or a .csv exported from this app.');
}

// ---- analysis exports ----

function isoWeek(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function sortedLive(entries) {
  return entries
    .filter((e) => !e.deletedAt)
    .sort((a, b) => (a.date === b.date ? (a.createdAt || '').localeCompare(b.createdAt || '') : a.date < b.date ? -1 : 1));
}

const TX_COLUMNS = [
  { header: 'Date', width: 12, format: 'date', get: (e) => ({ date: e.date }), csv: (e) => e.date },
  { header: 'Year', width: 7, format: 'int', get: (e) => Number(e.date.slice(0, 4)) },
  { header: 'Month', width: 9, get: (e) => e.date.slice(0, 7) },
  { header: 'Week', width: 10, get: (e) => isoWeek(e.date) },
  { header: 'Weekday', width: 11, get: (e) => WEEKDAYS[new Date(e.date + 'T00:00:00').getDay()] },
  { header: 'Type', width: 10, get: (e) => typeLabel(e.type) },
  { header: 'Category', width: 20, get: (e) => e.category },
  { header: 'Amount', width: 11, format: 'money', get: (e) => e.amount, csv: (e) => e.amount.toFixed(2) },
  { header: 'Currency', width: 9, get: () => 'SGD' },
  { header: 'Payment Method', width: 15, get: (e) => e.paymentMethod },
  { header: 'Location', width: 20, get: (e) => e.location },
  { header: 'Item', width: 22, get: (e) => e.itemName },
  { header: 'Meal Time', width: 10, get: (e) => e.mealTime },
  { header: 'Meal', width: 11, get: (e) => (e.type === 'food' ? mealBucketLabel(mealBucket(e.mealTime)) : '') },
  { header: 'From', width: 14, get: (e) => e.transportFrom },
  { header: 'To', width: 14, get: (e) => e.transportTo },
  { header: 'Notes', width: 28, get: (e) => e.notes },
  { header: 'Entry ID', width: 38, get: (e) => e.id },
];

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function buildCsv(entries) {
  const rows = [TX_COLUMNS.map((c) => c.header).join(',')];
  for (const e of sortedLive(entries)) {
    rows.push(TX_COLUMNS.map((c) => csvEscape(c.csv ? c.csv(e) : c.get(e))).join(','));
  }
  return {
    blob: new Blob([String.fromCharCode(0xfeff) + rows.join('\r\n')], { type: 'text/csv' }),
    filename: `oracle-transactions_${stamp()}.csv`,
  };
}

export function buildWorkbook(entries) {
  const list = sortedLive(entries);
  const budget = getSettings().monthlyBudget || 0;

  // Monthly: one row per month with type columns.
  const months = new Map();
  for (const e of list) {
    const m = e.date.slice(0, 7);
    const row = months.get(m) || { food: 0, non_food: 0, fixed: 0, count: 0 };
    row[e.type] = (row[e.type] || 0) + e.amount;
    row.count += 1;
    months.set(m, row);
  }
  const monthRows = [...months.entries()].map(([m, r]) => {
    const variable = r.food + r.non_food;
    const total = variable + r.fixed;
    const out = [m, r.count, r.food, r.non_food, r.fixed, variable, total];
    if (budget) out.push(budget, budget - variable);
    return out;
  });
  const monthCols = [
    { header: 'Month', width: 10 },
    { header: 'Entries', width: 9, format: 'int' },
    { header: 'Food', width: 12, format: 'money' },
    { header: 'Non-food', width: 12, format: 'money' },
    { header: 'Fixed', width: 12, format: 'money' },
    { header: 'Food + Non-food', width: 16, format: 'money' },
    { header: 'Total', width: 12, format: 'money' },
  ];
  if (budget) monthCols.push({ header: 'Budget', width: 12, format: 'money' }, { header: 'Left in budget', width: 15, format: 'money' });

  // Categories: all-time.
  const total = list.reduce((s, e) => s + e.amount, 0);
  const cats = new Map();
  for (const e of list) {
    const key = `${e.type}|${e.category}`;
    const c = cats.get(key) || { type: e.type, category: e.category, count: 0, sum: 0 };
    c.count += 1;
    c.sum += e.amount;
    cats.set(key, c);
  }
  const catRows = [...cats.values()]
    .sort((a, b) => b.sum - a.sum)
    .map((c) => [typeLabel(c.type), c.category, c.count, c.sum, c.sum / c.count, total ? c.sum / total : 0]);
  catRows.push(['Total', '', list.length, total, list.length ? total / list.length : 0, total ? 1 : 0]);

  // Daily totals.
  const days = new Map();
  for (const e of list) {
    const d = days.get(e.date) || { total: 0, food: 0, count: 0 };
    d.total += e.amount;
    if (e.type === 'food') d.food += e.amount;
    d.count += 1;
    days.set(e.date, d);
  }
  const dayRows = [...days.entries()].map(([d, v]) => [{ date: d }, WEEKDAYS[new Date(d + 'T00:00:00').getDay()], v.count, v.food, v.total]);

  // Sums of decimals drift (0.1 + 0.2); keep every money cell at 2 decimals.
  const r2 = (v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
  const roundRows = (rows, skip = []) => rows.map((row) => row.map((v, i) => (skip.includes(i) ? v : r2(v))));
  monthRows.splice(0, monthRows.length, ...roundRows(monthRows));
  catRows.splice(0, catRows.length, ...roundRows(catRows, [5]));
  dayRows.splice(0, dayRows.length, ...roundRows(dayRows));

  const blob = buildXlsx([
    {
      name: 'Transactions',
      columns: TX_COLUMNS,
      rows: list.map((e) => TX_COLUMNS.map((c) => c.get(e))),
      autoFilter: true,
    },
    { name: 'Monthly', columns: monthCols, rows: monthRows, autoFilter: true },
    {
      name: 'Categories',
      columns: [
        { header: 'Type', width: 10 },
        { header: 'Category', width: 22 },
        { header: 'Entries', width: 9, format: 'int' },
        { header: 'Total', width: 12, format: 'money' },
        { header: 'Average', width: 12, format: 'money' },
        { header: 'Share', width: 9, format: 'percent' },
      ],
      rows: catRows,
      totalRow: true,
    },
    {
      name: 'Daily',
      columns: [
        { header: 'Date', width: 12, format: 'date' },
        { header: 'Weekday', width: 11 },
        { header: 'Entries', width: 9, format: 'int' },
        { header: 'Food', width: 12, format: 'money' },
        { header: 'Total', width: 12, format: 'money' },
      ],
      rows: dayRows,
      autoFilter: true,
    },
  ]);
  return { blob, filename: `oracle-analysis_${stamp()}.xlsx` };
}
