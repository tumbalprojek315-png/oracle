import { h } from '../dom.js';
import { PERIODS, rangeForPeriod } from '../periods.js';
import { todayISO, toISO, formatDateShort } from '../format.js';
import { chipGroup } from './chips.js';
import { datePicker } from './datePicker.js';

// Period chips + custom range row, shared by every analytics screen.
export function periodSelector({ onChange, initialPeriod = 'month' }) {
  let period = initialPeriod;
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 29);
  let customStart = toISO(monthAgo);
  let customEnd = todayISO();

  const chips = chipGroup({
    options: PERIODS.map((p) => ({ value: p.key, label: p.label })),
    value: period,
    ariaLabel: 'Period',
    onChange: (val) => {
      period = val;
      customRow.hidden = val !== 'custom';
      onChange();
    },
  });
  chips.classList.add('chip-scroller');

  function syncOrder() {
    if (customStart > customEnd) [customStart, customEnd] = [customEnd, customStart];
    startPicker.setValue(customStart);
    endPicker.setValue(customEnd);
  }

  const startPicker = datePicker({ value: customStart, compact: true, ariaLabel: 'Range start', onChange: (iso) => { customStart = iso; syncOrder(); onChange(); } });
  const endPicker = datePicker({ value: customEnd, compact: true, ariaLabel: 'Range end', onChange: (iso) => { customEnd = iso; syncOrder(); onChange(); } });
  const customRow = h('div', { class: 'custom-range', hidden: true }, [startPicker, h('span', { class: 'muted' }, '→'), endPicker]);

  const root = h('div', { class: 'period-selector' }, [chips, customRow]);

  return {
    root,
    getPeriodKey: () => period,
    getRange: () => rangeForPeriod(period, customStart, customEnd),
    getLabel: () => {
      if (period === 'custom') {
        const { start, end } = rangeForPeriod(period, customStart, customEnd);
        return `${formatDateShort(start)} – ${formatDateShort(end)}`;
      }
      return (PERIODS.find((p) => p.key === period) || {}).label || '';
    },
  };
}
