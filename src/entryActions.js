// Add / edit / delete flows and the entry row, shared by Home and Activity.
import { t } from './i18n.js';
import { h } from './dom.js';
import { saveEntry, removeEntry, restoreEntry } from './store.js';
import { entryForm } from './components/entryForm.js';
import { openSheet, closeSheet, toast } from './components/sheet.js';
import { formatCurrency } from './format.js';
import { categoryIcon, TYPE_COLOR, CAT_TRANSPORTATION } from './categories.js';
import { icon } from './icons.js';

let lastUsed = null; // type/category of the last save, so "add" starts where you left off (date always starts on today)

export function openAddSheet(defaults = null) {
  const form = entryForm({
    mode: 'create',
    defaults: defaults || lastUsed,
    onSave: async (record, { again }) => {
      const saved = await saveEntry(record);
      lastUsed = { type: record.type, category: record.category };
      toast(t('Saved {amount} · {category}', { amount: formatCurrency(saved.amount), category: saved.category }), {
        action: { label: 'Undo', onClick: () => removeEntry(saved.id) },
      });
      if (!again) closeSheet();
    },
  });
  openSheet(form, { title: 'New expense', tall: true, onClose: () => form.destroy() });
}

export function openEditSheet(entry) {
  const form = entryForm({
    mode: 'edit',
    initial: entry,
    onSave: async (record) => {
      await saveEntry(record);
      toast('Changes saved');
      closeSheet();
    },
    onDelete: async (id) => {
      const removed = await removeEntry(id);
      closeSheet();
      toast('Entry deleted', { action: { label: 'Undo', onClick: () => restoreEntry(removed) } });
    },
  });
  openSheet(form, { title: 'Edit expense', tall: true, onClose: () => form.destroy() });
}

function subtitleFor(e) {
  const bits = [];
  if (e.type === 'food') {
    if (e.itemName) bits.push(e.itemName);
    if (e.location) bits.push(e.location);
  } else if (e.category === CAT_TRANSPORTATION && (e.transportFrom || e.transportTo)) {
    bits.push([e.transportFrom, e.transportTo].filter(Boolean).join(' → '));
  } else if (e.itemName) bits.push(e.itemName);
  if (!bits.length && e.notes) bits.push(e.notes);
  return bits.join(' · ');
}

export function orb(iconName, color, size = 'md') {
  return h('span', { class: `orb orb-${size}`, style: `--orb:${color}` }, icon(iconName, size === 'sm' ? 16 : 20));
}

// When the expense happened: the meal time for food, otherwise the time it
// was logged (only if it was logged on the same day). '' when unknown.
export function entryTime(entry) {
  if (entry.mealTime) return entry.mealTime;
  if (!entry.createdAt) return '';
  const d = new Date(entry.createdAt);
  const pad = (n) => String(n).padStart(2, '0');
  const sameDay = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === entry.date;
  return sameDay ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

// `select` = { selected, onToggle } turns the row into a checkbox row
// (Activity's select mode) instead of opening the edit sheet.
// `showTime` adds the time on the left (Activity).
export function entryRow(entry, select = null, { showTime = false } = {}) {
  const sub = subtitleFor(entry);
  const row = h(
    'button',
    {
      type: 'button',
      class: 'entry-row' + (select ? ' is-selectable' : '') + (select?.selected ? ' is-selected' : ''),
      'aria-pressed': select ? String(!!select.selected) : null,
      onClick: () => {
        if (!select) return openEditSheet(entry);
        const on = !row.classList.contains('is-selected');
        row.classList.toggle('is-selected', on);
        row.setAttribute('aria-pressed', String(on));
        select.onToggle(entry.id, on);
      },
    },
    []
  );
  row.append(
    ...[
      select ? h('span', { class: 'check', 'aria-hidden': 'true' }, icon('check', 14)) : null,
      showTime ? h('span', { class: 'entry-time' }, entryTime(entry) || '–') : null,
      ...entryRowParts(entry, sub),
    ].filter(Boolean)
  );
  return row;
}

function entryRowParts(entry, sub) {
  return [
    orb(categoryIcon(entry.category, entry.type), TYPE_COLOR[entry.type] || 'var(--ink-3)'),
    h('span', { class: 'entry-main' }, [
      h('span', { class: 'entry-title' }, entry.category),
      sub ? h('span', { class: 'entry-sub', 'data-no-i18n': '' }, sub) : null, // user text: never translated
    ]),
    h('span', { class: 'entry-side' }, [
      h('span', { class: 'entry-amt' }, formatCurrency(entry.amount)),
      entry.paymentMethod ? h('span', { class: 'entry-pay' }, entry.paymentMethod) : null,
    ]),
  ];
}

export function sortNewestFirst(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    const ta = entryTime(a);
    const tb = entryTime(b);
    if (ta && tb && ta !== tb) return tb.localeCompare(ta);
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}
