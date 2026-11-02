import { h, clear } from '../dom.js';
import { t, tn, locale } from '../i18n.js';
import { getEntries, subscribe, sumAmount, removeEntries, restoreEntries } from '../store.js';
import { formatCurrency, formatCurrencyCompact, formatDateLabel, currencySymbol, todayISO, toISO } from '../format.js';
import { TYPES } from '../categories.js';
import { chipGroup } from '../components/chips.js';
import { confirmDialog, toast } from '../components/sheet.js';
import { entryRow, sortNewestFirst } from '../entryActions.js';
import { icon } from '../icons.js';

const PAGE = 150;

// Day totals in the calendar: whole dollars up to 999, then "$1.2K".
function cellAmount(v) {
  return v < 1000 ? `${currencySymbol()}${Math.round(v)}` : formatCurrencyCompact(v);
}

export function createActivityView() {
  const root = h('div', { class: 'view view-activity' });
  let query = '';
  let typeFilter = 'all';
  let limit = PAGE;
  let filtered = [];

  // ---- calendar: one month of day totals; tapping a day shows only that day ----
  const today = todayISO();
  let calMonth = today.slice(0, 7); // 'YYYY-MM' on screen
  let selectedDay = today; // null = every day
  const calendar = h('section', { class: 'glass card cal-card' });

  // ---- select mode ----
  let selecting = false;
  const selected = new Set();

  const searchInput = h('input', {
    type: 'search',
    class: 'input',
    placeholder: 'Search place, item, category, notes…',
    'aria-label': 'Search entries',
    onInput: (e) => {
      query = e.target.value.trim().toLowerCase();
      limit = PAGE;
      renderList();
    },
  });

  const filterChips = chipGroup({
    options: [{ value: 'all', label: 'All' }, ...TYPES.map((t) => ({ value: t.key, label: t.label, icon: t.icon }))],
    value: 'all',
    ariaLabel: 'Filter by type',
    onChange: (val) => {
      typeFilter = val;
      limit = PAGE;
      renderList();
    },
  });
  filterChips.classList.add('chip-scroller');

  const summary = h('p', { class: 'list-summary' });
  const toolActions = h('div', { class: 'list-actions' });
  const listEl = h('div', { class: 'activity-list' });

  // Bottom bar shown in select mode (replaces the dock).
  const barCount = h('span', { class: 'select-count' });
  const barTotal = h('span', { class: 'select-total' });
  const deleteBtn = h('button', { type: 'button', class: 'btn btn-danger', onClick: deleteSelected }, [icon('trash', 18), h('span', {}, 'Delete')]);
  const selectBar = h('div', { class: 'select-bar', hidden: true, role: 'toolbar', 'aria-label': 'Selection' }, [
    h('div', { class: 'select-info' }, [barCount, barTotal]),
    deleteBtn,
  ]);

  root.append(
    h('header', { class: 'view-head' }, [h('div', {}, [h('p', { class: 'eyebrow' }, 'Every expense'), h('h1', { class: 'view-title' }, 'Activity')])]),
    calendar,
    h('div', { class: 'sticky-tools' }, [h('div', { class: 'input-wrap search' }, [icon('search', 18), searchInput]), filterChips]),
    h('div', { class: 'list-toolbar' }, [summary, toolActions]),
    listEl,
    selectBar
  );

  function shiftMonth(delta) {
    const [y, m] = calMonth.split('-').map(Number);
    calMonth = toISO(new Date(y, m - 1 + delta, 1)).slice(0, 7);
    if (selectedDay && selectedDay.slice(0, 7) !== calMonth) selectedDay = null;
    renderList();
  }

  function pickDay(iso) {
    selectedDay = selectedDay === iso ? null : iso;
    limit = PAGE;
    renderList();
  }

  // Colour runs green → amber → red with the day's total. The top 10% of days
  // all read as red, so one big bill doesn't wash every other day out to green.
  function renderCalendar() {
    clear(calendar);
    const today = todayISO(); // fresh each time: the app may stay open past midnight
    const source = getEntries().filter((e) => (typeFilter === 'all' || e.type === typeFilter) && e.date.startsWith(calMonth));
    const totals = new Map();
    for (const e of source) totals.set(e.date, (totals.get(e.date) || 0) + e.amount);
    const values = [...totals.values()].filter((v) => v > 0).sort((a, b) => a - b);
    const scaleMax = values.length ? values[Math.floor(0.9 * (values.length - 1))] || values.at(-1) : 1;

    const [y, m] = calMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrent = calMonth === today.slice(0, 7);
    const title = first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });

    calendar.appendChild(
      h('div', { class: 'cal-head' }, [
        h('button', { type: 'button', class: 'cal-nav', 'aria-label': t('Previous month'), onClick: () => shiftMonth(-1) }, icon('chevronLeft', 18)),
        h('h2', { class: 'cal-title' }, title),
        h('button', { type: 'button', class: 'cal-nav', 'aria-label': t('Next month'), disabled: isCurrent, onClick: () => shiftMonth(1) }, icon('chevronRight', 18)),
      ])
    );

    // Monday first; 2024-01-01 was a Monday.
    const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale(), { weekday: 'short' }).slice(0, 3));
    const grid = h('div', { class: 'cal-grid', role: 'grid', 'aria-label': title }, weekdays.map((w) => h('span', { class: 'cal-wd', 'aria-hidden': 'true' }, w)));
    const lead = (first.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) grid.appendChild(h('span', { class: 'cal-blank' }));
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calMonth}-${String(d).padStart(2, '0')}`;
      const total = totals.get(iso) || 0;
      const future = iso > today;
      const heat = total > 0 ? Math.min(1, total / scaleMax) : null;
      grid.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'cal-day' + (total > 0 ? ' has-spend' : '') + (iso === today ? ' is-today' : '') + (iso === selectedDay ? ' is-selected' : '') + (future ? ' is-future' : ''),
            style: heat != null ? `--heat-h:${Math.round(140 * (1 - heat))}` : null,
            disabled: future,
            'aria-pressed': String(iso === selectedDay),
            'aria-label': `${formatDateLabel(iso)}: ${total > 0 ? formatCurrency(total) : t('nothing logged')}`,
            onClick: () => pickDay(iso),
          },
          [h('span', { class: 'cal-num' }, String(d)), total > 0 ? h('span', { class: 'cal-amt' }, cellAmount(total)) : null]
        )
      );
    }
    calendar.appendChild(grid);

    calendar.appendChild(
      h('div', { class: 'cal-foot' }, [
        h('span', { class: 'cal-legend', 'aria-hidden': 'true' }, [h('span', {}, t('Low')), h('span', { class: 'cal-legend-bar' }), h('span', {}, t('High'))]),
        h('span', { class: 'cal-summary' }, `${tn(source.length, 'entry', 'entries')} · ${formatCurrency(sumAmount(source))}`),
      ])
    );
  }

  function matches(e) {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (!query) return true;
    const hay = `${e.location} ${e.itemName} ${e.notes} ${e.transportFrom} ${e.transportTo} ${e.category} ${e.paymentMethod} ${e.amount}`.toLowerCase();
    return hay.includes(query);
  }

  function enterSelect() {
    selecting = true;
    selected.clear();
    document.body.classList.add('is-selecting');
    renderList();
  }

  function exitSelect() {
    if (!selecting) return;
    selecting = false;
    selected.clear();
    document.body.classList.remove('is-selecting');
    renderList();
  }

  function toggleAll() {
    const allOn = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
    if (allOn) selected.clear();
    else for (const e of filtered) selected.add(e.id);
    renderList();
  }

  function renderToolbar() {
    clear(toolActions);
    if (!getEntries().length) return;
    if (!selecting) {
      if (dayMode()) toolActions.appendChild(h('button', { type: 'button', class: 'pill-btn pill-sm', onClick: () => pickDay(selectedDay) }, [icon('calendar', 16), h('span', {}, t('All days'))]));
      toolActions.appendChild(h('button', { type: 'button', class: 'pill-btn pill-sm select-btn', onClick: enterSelect }, [icon('select', 16), h('span', {}, 'Select')]));
      return;
    }
    const allOn = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
    toolActions.append(
      h('button', { type: 'button', class: 'pill-btn pill-sm' + (allOn ? ' is-on' : ''), onClick: toggleAll }, [
        icon('select', 16),
        h('span', {}, allOn ? 'Deselect all' : t('Select all ({n})', { n: filtered.length })),
      ]),
      h('button', { type: 'button', class: 'pill-btn pill-sm', onClick: exitSelect }, 'Cancel')
    );
  }

  function updateBar() {
    selectBar.hidden = !selecting;
    const chosen = filtered.filter((e) => selected.has(e.id));
    barCount.textContent = chosen.length ? t('{n} selected', { n: chosen.length }) : 'Tap entries to select';
    barTotal.textContent = chosen.length ? formatCurrency(sumAmount(chosen)) : '';
    deleteBtn.disabled = !chosen.length;
  }

  function onToggle(id, on) {
    if (on) selected.add(id);
    else selected.delete(id);
    renderToolbar();
    updateBar();
  }

  async function deleteSelected() {
    const chosen = filtered.filter((e) => selected.has(e.id));
    if (!chosen.length) return;
    const n = chosen.length;
    const isAll = n === getEntries().length;
    const noun = n === 1 ? 'entry' : 'entries';
    const ok = await confirmDialog({
      title: isAll ? t('Delete all {n} entries?', { n }) : t('Delete {what}?', { what: tn(n, 'entry', 'entries') }),
      message: t('{amount} of expenses will be removed from this device, and from your other devices the next time you sync. You get a few seconds to undo; after that the data is gone for good.', { amount: formatCurrency(sumAmount(chosen)) }),
      acknowledge: n === 1 ? t('I understand this entry will be permanently deleted.') : t('I understand these {n} entries will be permanently deleted.', { n }),
      confirmLabel: t('Delete {n}', { n }),
      danger: true,
    });
    if (!ok) return;
    const removed = await removeEntries(chosen.map((e) => e.id));
    exitSelect();
    toast(t('Deleted {what}', { what: tn(removed.length, 'entry', 'entries') }), {
      action: { label: 'Undo', onClick: () => restoreEntries(removed) },
      duration: 8000,
    });
  }

  // A picked day narrows the list, unless you're searching (search looks everywhere).
  const dayMode = () => !!selectedDay && !query;

  function renderList() {
    clear(listEl);
    renderCalendar();
    const all = getEntries();
    filtered = sortNewestFirst(all.filter((e) => matches(e) && (!dayMode() || e.date === selectedDay)));
    // Keep only selections that are still visible under the current filter.
    const visible = new Set(filtered.map((e) => e.id));
    for (const id of [...selected]) if (!visible.has(id)) selected.delete(id);
    if (!all.length && selecting) {
      selecting = false;
      document.body.classList.remove('is-selecting');
    }
    renderToolbar();
    updateBar();

    if (!all.length) {
      summary.textContent = '';
      listEl.appendChild(emptyState('No expenses yet', 'Tap + to log one, or import a file in You → Sync & export.'));
      return;
    }
    if (!filtered.length) {
      summary.textContent = dayMode() ? formatDateLabel(selectedDay) : '';
      listEl.appendChild(dayMode() ? emptyState('Nothing logged on this day', 'Pick another day, or tap + to add one.') : emptyState('No matches', 'Try another word or filter.'));
      return;
    }
    summary.textContent = `${tn(filtered.length, 'entry', 'entries')} · ${formatCurrency(sumAmount(filtered))}`;

    // Month → day grouping, each with its total.
    const shown = filtered.slice(0, limit);
    const monthTotals = new Map();
    const dayTotals = new Map();
    for (const e of filtered) {
      monthTotals.set(e.date.slice(0, 7), (monthTotals.get(e.date.slice(0, 7)) || 0) + e.amount);
      dayTotals.set(e.date, (dayTotals.get(e.date) || 0) + e.amount);
    }
    let curMonth = null;
    let curDay = null;
    let dayList = null;
    for (const e of shown) {
      const m = e.date.slice(0, 7);
      if (m !== curMonth) {
        curMonth = m;
        const label = new Date(m + '-01T00:00:00').toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
        // one picked day: the calendar above already names the month
        if (!dayMode()) listEl.appendChild(h('div', { class: 'month-head' }, [h('span', {}, label), h('span', { class: 'month-total' }, formatCurrency(monthTotals.get(m)))]));
      }
      if (e.date !== curDay) {
        curDay = e.date;
        dayList = h('div', { class: 'entry-list' });
        listEl.appendChild(
          h('section', { class: 'glass day-group' }, [
            h('div', { class: 'day-head' }, [h('span', {}, formatDateLabel(e.date)), h('span', { class: 'day-total' }, formatCurrency(dayTotals.get(e.date)))]),
            dayList,
          ])
        );
      }
      dayList.appendChild(entryRow(e, selecting ? { selected: selected.has(e.id), onToggle } : null, { showTime: true }));
    }
    if (filtered.length > limit) {
      listEl.appendChild(
        h('button', { type: 'button', class: 'btn btn-ghost btn-block', onClick: () => { limit += PAGE; renderList(); } }, t('Show more ({n} left)', { n: filtered.length - limit }))
      );
    }
  }

  function emptyState(title, sub) {
    return h('div', { class: 'empty glass' }, [
      h('div', { class: 'empty-orbit', 'aria-hidden': 'true' }, [h('span'), h('span')]),
      h('p', { class: 'empty-title' }, title),
      h('p', { class: 'empty-sub' }, sub),
    ]);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selecting && !document.querySelector('.dialog')) exitSelect();
  });

  subscribe(() => !root.hidden && renderList());
  renderList();

  return { root, activate: renderList, deactivate: exitSelect };
}
