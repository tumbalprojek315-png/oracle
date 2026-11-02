import { h, clear } from '../dom.js';
import { t, tn, locale } from '../i18n.js';
import {
  getEntries,
  subscribe,
  sumAmount,
  sumByKey,
  topTextByFrequency,
  mealBucketStats,
  trendByMonth,
  dailyTotals,
  weekdayAverages,
} from '../store.js';
import { filterByRange, previousRangeFor, daysInRange, rangeForPeriod } from '../periods.js';
import { TYPES, TYPE_COLOR, typeLabel, countedTypes, countedLabel } from '../categories.js';
import { MEAL_BUCKETS } from '../mealTime.js';
import { formatCurrency, formatDateShort } from '../format.js';
import { periodSelector } from '../components/periodSelector.js';
import { money, donut, legend, columns, lineChart, barList, deltaPill, SERIES } from '../components/charts.js';
import { openEditSheet } from '../entryActions.js';
import { updateSettings } from '../store.js';
import { icon } from '../icons.js';

const MEAL_COLORS = { pagi: 'var(--c-amber)', siang: 'var(--c-mint)', sore: 'var(--c-blue)', malam: 'var(--c-lilac)' };

export function createInsightsView() {
  const root = h('div', { class: 'view view-insights' });
  const period = periodSelector({ initialPeriod: 'month', onChange: () => render() });
  const content = h('div', { class: 'insight-grid' });

  // Which types count in totals (also used by Home and the budget). Several
  // can be on; at least one always stays on.
  const countRow = h('div', { class: 'count-row', role: 'group', 'aria-label': 'Count in totals' });
  function renderCountRow() {
    clear(countRow);
    const on = countedTypes();
    countRow.appendChild(h('span', { class: 'count-label' }, 'Count in totals'));
    for (const t of TYPES) {
      const active = on.includes(t.key);
      countRow.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: 'chip chip-toggle' + (active ? ' is-selected' : ''),
            'aria-pressed': String(active),
            title: active && on.length === 1 ? 'At least one type must be counted' : '',
            onClick: async () => {
              const next = active ? on.filter((k) => k !== t.key) : [...on, t.key];
              if (!next.length) return;
              await updateSettings({ countedTypes: TYPES.map((x) => x.key).filter((k) => next.includes(k)) });
            },
          },
          [active ? icon('check', 14) : null, h('span', {}, t.label)]
        )
      );
    }
  }

  root.append(
    h('header', { class: 'view-head' }, [h('div', {}, [h('p', { class: 'eyebrow' }, 'Understand your spending'), h('h1', { class: 'view-title' }, 'Insights')])]),
    h('div', { class: 'insight-controls' }, [period.root, countRow]),
    content
  );

  function card(title, children, { wide = false, sub } = {}) {
    return h('section', { class: 'glass card' + (wide ? ' card-wide' : '') }, [
      h('div', { class: 'card-head' }, [h('h2', { class: 'card-title' }, title), sub ? h('span', { class: 'card-sub' }, sub) : null]),
      ...[].concat(children),
    ]);
  }

  // Daily columns for short ranges, weekly for long ones.
  function timeColumns(list, start, end) {
    const days = dailyTotals(list, start, end);
    if (days.length <= 45) {
      const avg = sumAmount(list) / days.length;
      return columns(
        days.map((d) => ({ label: String(Number(d.date.slice(8))), full: formatDateShort(d.date), value: d.value })),
        { avg, labelEvery: days.length > 16 ? 5 : 1, highlightLast: false, highlightMax: true } // biggest day in amber, like the biggest expense
      );
    }
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      weeks.push({ label: formatDateShort(chunk[0].date), full: t('Week of {date}', { date: formatDateShort(chunk[0].date) }), value: chunk.reduce((s, d) => s + d.value, 0) });
    }
    return columns(weeks, { labelEvery: Math.ceil(weeks.length / 5) });
  }

  function renderOverview(all, start, end) {
    const types = countedTypes();
    const variableAll = all.filter((e) => types.includes(e.type));
    const inRange = filterByRange(variableAll, start, end);
    const variable = inRange;
    const notCounted = filterByRange(all.filter((e) => !types.includes(e.type)), start, end);
    const total = sumAmount(variable);
    const days = daysInRange(start, end);
    const prev = previousRangeFor(period.getPeriodKey(), start, end);
    const prevTotal = sumAmount(filterByRange(variableAll, prev.start, prev.end));
    const biggest = [...variable].sort((a, b) => b.amount - a.amount)[0];

    if (!inRange.length) {
      content.appendChild(emptyCard());
      return;
    }

    content.appendChild(
      card(
        'Spending',
        [
          h('div', { class: 'summary-top' }, [money(total, 'money-xl'), deltaPill(total, prevTotal, prev.label, prevName(prev))]),
          h('div', { class: 'kv-grid' }, [
            kv('Per day', formatCurrency(total / days)),
            kv('Entries', String(variable.length)),
            ...TYPES.filter((t) => types.includes(t.key) && types.length > 1).map((t) => kv(t.label, formatCurrency(sumAmount(variable.filter((e) => e.type === t.key))))),
            notCounted.length ? kv('Not counted', formatCurrency(sumAmount(notCounted))) : null,
          ]),
          biggest
            ? h('button', { type: 'button', class: 'biggest', onClick: () => openEditSheet(biggest) }, [
                h('span', { class: 'biggest-label' }, [icon('bolt', 14), h('span', {}, 'Biggest expense')]),
                h('span', { class: 'biggest-line' }, [
                  h('strong', {}, formatCurrency(biggest.amount)),
                  h('span', { 'data-no-i18n': '' }, ` · ${biggest.category}${biggest.itemName ? ' · ' + biggest.itemName : ''} · ${formatDateShort(biggest.date)}`),
                ]),
              ])
            : null,
        ],
        { sub: countedLabel() }
      )
    );

    content.appendChild(card(days <= 45 ? 'Day by day' : 'Week by week', timeColumns(variable, start, end), { sub: 'Tap a bar' }));

    const typeSegs = TYPES.filter((t) => types.includes(t.key)).map((t) => ({ label: t.label, value: sumAmount(inRange.filter((e) => e.type === t.key)), color: TYPE_COLOR[t.key] }));
    content.appendChild(
      card('By type', h('div', { class: 'donut-block' }, [donut(typeSegs, { size: 150, thickness: 14, centerTop: 'Total', centerValue: formatCurrency(sumAmount(inRange)) }), legend(typeSegs)]))
    );

    const byCat = [...sumByKey(variable, (e) => `${e.type}|${e.category}`).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, value]) => {
        const [type, label] = k.split('|');
        return { label, value, sub: typeLabel(type), color: TYPE_COLOR[type] };
      });
    content.appendChild(card('Categories', barList(byCat, { total }), { sub: 'Share of spending' }));

    const meals = mealTimeCard(variable);
    if (meals) content.appendChild(meals);

    content.appendChild(
      // Habit chart: fixed costs (rent, bills) would make their payment day look like a spending spree.
      card('Weekday pattern', columns(weekdayAverages(variable.filter((e) => e.type !== 'fixed'), start, end), { color: 'var(--c-blue)' }), { sub: 'Average per day · without Fixed' })
    );

    const byPay = [...sumByKey(inRange, (e) => e.paymentMethod || 'Not set').entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: SERIES[i % SERIES.length] }));
    content.appendChild(card('Paid with', barList(byPay, { total: sumAmount(inRange) })));

    const months = trendByMonth(variableAll, 6);
    content.appendChild(
      card(
        'Last 6 months',
        lineChart(months.map((m) => ({ label: m.label, full: new Date(m.key + '-01T00:00:00').toLocaleDateString(locale(), { month: 'long', year: 'numeric' }), value: m.value }))),
        { sub: thisMonthChange(variableAll) }
      )
    );

    content.appendChild(
      card('Top items', barList(topTextByFrequency(variable, 'itemName', 6).map((i) => ({ label: i.name, sub: t('{n}× · Avg {avg}', { n: i.count, avg: formatCurrency(i.sum / i.count) }), value: i.sum })), { emptyText: 'Add an item name when logging to see this.' }))
    );
    content.appendChild(
      card('Top places', barList(topTextByFrequency(variable, 'location', 6).map((i) => ({ label: i.name, sub: t('{n}× · Avg {avg}', { n: i.count, avg: formatCurrency(i.sum / i.count) }), value: i.sum })), { color: 'var(--c-blue)', emptyText: 'Add a place when logging food to see this.' }))
    );
  }

  // Meal times (from the old Food tab): only while Food is counted.
  function mealTimeCard(list) {
    const food = list.filter((e) => e.type === 'food');
    if (!food.length) return null;
    const total = sumAmount(food);
    const stats = mealBucketStats(food);
    const mealItems = MEAL_BUCKETS.map((b) => {
      const s = stats.get(b.key);
      return { label: t(b.label), sub: t(b.range) + (s.count ? ' · ' + t('{n}× · Avg {avg}', { n: s.count, avg: formatCurrency(s.sum / s.count) }) : ''), value: s.sum, color: MEAL_COLORS[b.key] };
    });
    return card('By meal time', barList(mealItems, { total }), { sub: t('Food · {avg} per meal', { avg: formatCurrency(total / food.length) }) });
  }

  // Short name for the comparison pill: the month ("vs September") when
  // looking at this month; other periods keep their full wording.
  function prevName(prev) {
    if (period.getPeriodKey() !== 'month') return null;
    return new Date(prev.start + 'T00:00:00').toLocaleDateString(locale(), { month: 'long' });
  }

  // "▼ 8% this month": this month so far vs the same days of last month,
  // whatever period is picked above.
  function thisMonthChange(list) {
    const cur = rangeForPeriod('month');
    const prev = previousRangeFor('month', cur.start, cur.end);
    const now = sumAmount(filterByRange(list, cur.start, cur.end));
    const before = sumAmount(filterByRange(list, prev.start, prev.end));
    if (before <= 0 || now === before) return countedLabel();
    const up = now > before;
    const pct = Math.round((Math.abs(now - before) / before) * 100);
    if (!pct) return countedLabel();
    return h('span', { class: 'delta delta-sm ' + (up ? 'delta-up' : 'delta-down'), title: t(up ? '{pct}% more vs {p}' : '{pct}% less vs {p}', { pct, p: t(prev.label) }) }, [
      h('span', { class: 'delta-arrow', 'aria-hidden': 'true' }, up ? '▲' : '▼'),
      t('{pct}% this month', { pct }),
    ]);
  }

  function kv(label, value) {
    return h('div', { class: 'kv' }, [h('span', { class: 'kv-label' }, label), h('span', { class: 'kv-value' }, value)]);
  }

  function emptyCard(text = 'No expenses in this period.') {
    const nothingYet = !getEntries().length;
    return h('div', { class: 'empty glass card-wide' }, [
      h('div', { class: 'empty-orbit', 'aria-hidden': 'true' }, [h('span'), h('span')]),
      h('p', { class: 'empty-title' }, nothingYet ? 'No expenses yet' : text),
      h('p', { class: 'empty-sub' }, nothingYet ? 'Tap + to log your first expense. Your insights show up here.' : 'Pick another period above.'),
    ]);
  }

  function render() {
    renderCountRow();
    clear(content);
    const { start, end } = period.getRange();
    renderOverview(getEntries(), start, end);
  }

  subscribe(() => !root.hidden && render());
  render();
  return { root, activate: render, deactivate() {} };
}
