import { h, clear } from '../dom.js';
import { t, tn, locale } from '../i18n.js';
import { getEntries, getSettings, subscribe, sumAmount, sumByKey, updateSettings } from '../store.js';
import { filterByRange, rangeForPeriod, previousRangeFor } from '../periods.js';
import { formatCurrency, greeting, relativeTime, todayISO } from '../format.js';
import { money, donut, legend, ring, deltaPill, SERIES } from '../components/charts.js';
import { entryRow, openAddSheet, sortNewestFirst } from '../entryActions.js';
import { oldCloudSpaceToken } from '../legacy.js';
import { icon } from '../icons.js';
import { countedTypes, countedLabel } from '../categories.js';

export function createHomeView({ navigate }) {
  const root = h('div', { class: 'view view-home' });

  function render() {
    clear(root);
    const all = getEntries();
    const s = getSettings();
    const counted = countedTypes();
    const variable = all.filter((e) => counted.includes(e.type));
    const { start, end } = rangeForPeriod('month');
    const monthVar = filterByRange(variable, start, end);
    const monthFixed = filterByRange(all.filter((e) => e.type === 'fixed'), start, end);
    const spent = sumAmount(monthVar);
    const prev = previousRangeFor('month', start, end);
    const prevSpent = sumAmount(filterByRange(variable, prev.start, prev.end));
    const today = todayISO();
    const todaySpent = sumAmount(variable.filter((e) => e.date === today));
    const wk = rangeForPeriod('week');
    const weekSpent = sumAmount(filterByRange(variable, wk.start, wk.end));

    root.appendChild(
      h('header', { class: 'view-head' }, [
        h('div', {}, [
          h('p', { class: 'eyebrow' }, new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })),
          h('h1', { class: 'view-title' }, s.name ? `${greeting()}, ${s.name}` : greeting()),
        ]),
      ])
    );

    // One-time migration banner from the old cloud version.
    if (!all.length && oldCloudSpaceToken() && !s.legacyDismissed) {
      root.appendChild(
        h('div', { class: 'glass banner' }, [
          h('div', {}, [
            h('p', { class: 'banner-title' }, 'Bring over your old Ledger data'),
            h('p', { class: 'banner-text' }, 'This device used the old cloud version. Pull those entries in once (needs internet one time), then everything works offline.'),
          ]),
          h('div', { class: 'banner-actions' }, [
            h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onClick: () => updateSettings({ legacyDismissed: true }, { touch: false }) }, 'Not now'),
            h('button', { type: 'button', class: 'btn btn-primary btn-sm', onClick: () => navigate('you/sync') }, 'Import'),
          ]),
        ])
      );
    }

    // ---- hero ----
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate() + 1;
    const budget = s.monthlyBudget || 0;
    const monthName = now.toLocaleDateString(locale(), { month: 'long' });

    const heroText = h('div', { class: 'hero-text' }, [
      h('p', { class: 'eyebrow' }, t('Spent in {month}', { month: monthName })),
      counted.length < 3 ? h('p', { class: 'hero-scope' }, t('Counting {types}', { types: countedLabel() })) : null,
      money(spent, 'money-xl'),
      deltaPill(spent, prevSpent, 'last month'),
    ]);

    let heroSide;
    if (budget > 0) {
      const left = budget - spent;
      const ratio = spent / budget;
      heroSide = ring(ratio, {
        size: 128,
        children: [
          h('span', { class: 'ring-pct' }, `${Math.round(ratio * 100)}%`),
          h('span', { class: 'ring-label' }, 'Of budget'),
        ],
      });
      heroText.appendChild(
        h(
          'p',
          { class: 'hero-note' + (left < 0 ? ' is-over' : '') },
          left >= 0
            ? [h('strong', {}, formatCurrency(left)), ' ' + t('left of {budget} · {n} to go', { budget: formatCurrency(budget), n: tn(daysLeft, 'day', 'days') })]
            : [h('strong', {}, formatCurrency(-left)), ' ' + t('over budget this month')]
        )
      );
    } else {
      heroSide = h('button', { type: 'button', class: 'ring-empty', onClick: () => navigate('you/budget') }, [icon('target', 22), h('span', {}, 'Set a budget')]);
    }
    root.appendChild(h('section', { class: 'glass hero' }, [heroText, heroSide]));

    // ---- quick stats ----
    root.appendChild(
      h('div', { class: 'stat-strip' }, [
        stat('Today', todaySpent),
        stat('Last 7 days', weekSpent),
        stat('Fixed costs', sumAmount(monthFixed), 'This month'),
      ])
    );

    // ---- where it went ----
    if (monthVar.length) {
      const byCat = [...sumByKey(monthVar, (e) => e.category).entries()].sort((a, b) => b[1] - a[1]);
      const top = byCat.slice(0, 5);
      const rest = byCat.slice(5).reduce((s2, [, v]) => s2 + v, 0);
      const segs = top.map(([label, value], i) => ({ label, value, color: SERIES[i] }));
      if (rest > 0) segs.push({ label: 'Other', value: rest, color: SERIES[6] });
      root.appendChild(
        h('section', { class: 'glass card' }, [
          h('div', { class: 'card-head' }, [
            h('h2', { class: 'card-title' }, 'Where it went'),
            h('button', { type: 'button', class: 'link-btn', onClick: () => navigate('insights') }, ['Insights', icon('chevronRight', 16)]),
          ]),
          h('div', { class: 'donut-block' }, [
            donut(segs, { size: 150, thickness: 14, centerTop: `${monthVar.length}`, centerSub: monthVar.length === 1 ? 'Entry' : 'Entries' }),
            legend(segs),
          ]),
        ])
      );
    }

    // ---- recent ----
    const recent = sortNewestFirst(all).slice(0, 6);
    const recentCard = h('section', { class: 'glass card' }, [
      h('div', { class: 'card-head' }, [
        h('h2', { class: 'card-title' }, 'Recent'),
        all.length ? h('button', { type: 'button', class: 'link-btn', onClick: () => navigate('activity') }, ['All activity', icon('chevronRight', 16)]) : null,
      ]),
    ]);
    if (!recent.length) {
      recentCard.appendChild(
        h('div', { class: 'empty' }, [
          h('div', { class: 'empty-orbit', 'aria-hidden': 'true' }, [h('span'), h('span')]),
          h('p', { class: 'empty-title' }, 'Nothing logged yet'),
          h('p', { class: 'empty-sub' }, 'Tap the + button to log your first expense. It takes about 5 seconds.'),
          h('button', { type: 'button', class: 'btn btn-primary', onClick: () => openAddSheet() }, [icon('plus', 18), h('span', {}, 'Log an expense')]),
        ])
      );
    } else {
      recentCard.appendChild(h('div', { class: 'entry-list' }, recent.map((e) => entryRow(e))));
    }
    root.appendChild(recentCard);

    // ---- backup nudge ----
    const staleDays = s.lastExportAt ? (Date.now() - new Date(s.lastExportAt).getTime()) / 86400000 : Infinity;
    if (all.length >= 5 && staleDays > 7) {
      root.appendChild(
        h('button', { type: 'button', class: 'glass nudge', onClick: () => navigate('you/sync') }, [
          h('span', { class: 'orb orb-md', style: '--orb:var(--c-amber)' }, icon('sync', 20)),
          h('span', { class: 'nudge-text' }, [
            h('strong', {}, s.lastExportAt ? t('Last synced {when}', { when: relativeTime(s.lastExportAt) }) : 'Not backed up yet'),
            h('span', {}, 'Your data lives only on this device. Send a sync file to your laptop.'),
          ]),
          icon('chevronRight', 18),
        ])
      );
    }
  }

  function stat(label, value, sub) {
    return h('div', { class: 'stat glass' }, [h('span', { class: 'stat-label' }, label), money(value, 'money-md'), sub ? h('span', { class: 'stat-sub' }, sub) : null]);
  }

  subscribe(() => !root.hidden && render());
  render();

  return {
    root,
    activate: render,
    deactivate() {},
  };
}
