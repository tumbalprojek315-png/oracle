import { h, clear } from '../dom.js';
import { t, tn, locale } from '../i18n.js';
import { todayISO, toISO, formatDateLabel } from '../format.js';
import { icon } from '../icons.js';

// Monday-first weekday initials in the current language (5 Jan 2026 is a Monday).
const dow = () => Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(locale(), { weekday: 'narrow' }));
let closeOpenOne = null;

// Pill button + popover calendar (Monday-first) with quick picks.
export function datePicker({ value, onChange, ariaLabel, compact = false }) {
  let selected = value || todayISO();
  let viewMonth = new Date(selected + 'T00:00:00');
  viewMonth.setDate(1);

  const label = h('span', {});
  const trigger = h(
    'button',
    {
      type: 'button',
      class: 'pill-btn date-pill',
      'aria-haspopup': 'dialog',
      'aria-label': ariaLabel || 'Pick a date',
      onClick: (e) => {
        e.stopPropagation();
        popover.hidden ? open() : close();
      },
    },
    [icon('calendar', 16), label]
  );

  const popover = h('div', { class: 'date-popover', hidden: true, role: 'dialog', 'aria-label': 'Calendar' });

  function setLabel() {
    label.textContent = compact ? formatShort(selected) : formatDateLabel(selected);
    trigger.classList.toggle('is-past', selected !== todayISO());
  }

  function formatShort(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function renderPopover() {
    clear(popover);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const y2 = new Date();
    y2.setDate(y2.getDate() - 2);
    popover.appendChild(
      h('div', { class: 'date-quick-row' }, [
        h('button', { type: 'button', class: 'chip', onClick: () => pick(todayISO()) }, 'Today'),
        h('button', { type: 'button', class: 'chip', onClick: () => pick(toISO(y)) }, 'Yesterday'),
        h('button', { type: 'button', class: 'chip', onClick: () => pick(toISO(y2)) }, '2 days ago'),
      ])
    );

    const monthLabel = viewMonth.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
    popover.appendChild(
      h('div', { class: 'date-cal-nav' }, [
        h('button', { type: 'button', class: 'orb-btn orb-sm', 'aria-label': 'Previous month', onClick: (e) => { e.stopPropagation(); viewMonth.setMonth(viewMonth.getMonth() - 1); renderPopover(); } }, icon('chevronLeft', 16)),
        h('span', { class: 'date-cal-month' }, monthLabel),
        h('button', { type: 'button', class: 'orb-btn orb-sm', 'aria-label': 'Next month', onClick: (e) => { e.stopPropagation(); viewMonth.setMonth(viewMonth.getMonth() + 1); renderPopover(); } }, icon('chevronRight', 16)),
      ])
    );

    const grid = h('div', { class: 'date-cal-grid' });
    for (const d of dow()) grid.appendChild(h('span', { class: 'date-cal-dow' }, d));
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const today = todayISO();
    for (let i = 0; i < offset; i++) grid.appendChild(h('span', {}));
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISO(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
      grid.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'date-cal-day' + (iso === selected ? ' is-selected' : '') + (iso === today ? ' is-today' : '') + (iso > today ? ' is-future' : ''),
            disabled: iso > today, // expenses can't be in the future
            onClick: () => pick(iso),
          },
          String(d)
        )
      );
    }
    popover.appendChild(grid);
  }

  function pick(iso) {
    selected = iso;
    viewMonth = new Date(iso + 'T00:00:00');
    viewMonth.setDate(1);
    setLabel();
    onChange(iso);
    close();
  }

  function onDocClick(e) {
    if (!wrap.contains(e.target)) close();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  }

  function open() {
    if (closeOpenOne) closeOpenOne();
    renderPopover();
    popover.hidden = false;
    closeOpenOne = close;
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
    document.addEventListener('keydown', onKeydown, true);
  }
  function close() {
    popover.hidden = true;
    document.removeEventListener('click', onDocClick);
    document.removeEventListener('keydown', onKeydown, true);
    if (closeOpenOne === close) closeOpenOne = null;
  }

  const wrap = h('div', { class: 'date-picker' }, [trigger, popover]);
  setLabel();

  wrap.setValue = (iso) => {
    selected = iso;
    viewMonth = new Date(iso + 'T00:00:00');
    viewMonth.setDate(1);
    setLabel();
  };
  wrap.getValue = () => selected;
  return wrap;
}
