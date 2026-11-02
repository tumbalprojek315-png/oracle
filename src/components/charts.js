import { h, svg } from '../dom.js';
import { t, tn, locale } from '../i18n.js';
import { formatCurrency, formatCurrencyCompact, currencyParts } from '../format.js';

// "<1%" instead of a misleading "0%" for small but real amounts.
export function sharePct(value, total) {
  if (!total || !value) return '0%';
  const pct = (value / total) * 100;
  return pct < 1 ? '<1%' : `${Math.round(pct)}%`;
}

export const SERIES = ['var(--c-mint)', 'var(--c-blue)', 'var(--c-amber)', 'var(--c-pink)', 'var(--c-lilac)', 'var(--c-lime)', 'var(--ink-3)'];

// Big money figure with small cents.
export function money(amount, cls = '') {
  const p = currencyParts(amount);
  return h('span', { class: 'money ' + cls }, [
    h('span', { class: 'money-sym' }, p.symbol),
    h('span', { class: 'money-whole' }, p.whole),
    p.cents ? h('span', { class: 'money-cents' }, '.' + p.cents) : null,
  ]);
}

// Donut from segments [{label, value, color}] with a center label.
// Circles with dash arrays; round caps and a small gap between arcs.
export function donut(segments, { size = 168, thickness = 16, centerTop, centerValue, centerSub } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'donut-svg', role: 'img', 'aria-label': 'Spending split' });
  root.appendChild(svg('circle', { cx: size / 2, cy: size / 2, r, class: 'donut-track', 'stroke-width': thickness, fill: 'none' }));
  if (total > 0) {
    const shown = segments.filter((s) => s.value > 0);
    const gap = shown.length > 1 ? Math.min(thickness * 0.9, c * 0.02) + thickness : 0; // round caps eat `thickness` of length
    let offset = 0;
    for (const seg of shown) {
      const len = (seg.value / total) * c;
      const drawn = Math.max(len - gap, 0.001);
      root.appendChild(
        svg('circle', {
          cx: size / 2,
          cy: size / 2,
          r,
          fill: 'none',
          stroke: seg.color,
          'stroke-width': thickness,
          'stroke-linecap': shown.length > 1 && drawn > 1 ? 'round' : 'butt',
          'stroke-dasharray': `${drawn} ${c - drawn}`,
          'stroke-dashoffset': String(-(offset + gap / 2)),
          transform: `rotate(-90 ${size / 2} ${size / 2})`,
          class: 'donut-arc',
        }, [svg('title', {}, [document.createTextNode(`${seg.label}: ${formatCurrency(seg.value)}`)])])
      );
      offset += len;
    }
  }
  return h('div', { class: 'donut', style: `width:${size}px;height:${size}px` }, [
    root,
    h('div', { class: 'donut-center' }, [
      centerTop ? h('span', { class: 'donut-top' }, centerTop) : null,
      centerValue != null ? h('span', { class: 'donut-value' }, centerValue) : null,
      centerSub ? h('span', { class: 'donut-sub' }, centerSub) : null,
    ]),
  ]);
}

export function legend(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return h(
    'div',
    { class: 'legend' },
    segments.map((seg) =>
      h('div', { class: 'legend-row' }, [
        h('span', { class: 'legend-dot', style: `background:${seg.color}` }),
        h('span', { class: 'legend-name' }, seg.label),
        h('span', { class: 'legend-pct' }, sharePct(seg.value, total)),
        h('span', { class: 'legend-amt' }, formatCurrency(seg.value)),
      ])
    )
  );
}

// Circular progress ring (budget). `ratio` 0..1+, turns amber >85%, pink >100%.
export function ring(ratio, { size = 132, thickness = 12, children } = {}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(ratio, 1));
  const tone = ratio > 1 ? 'var(--c-pink)' : ratio > 0.85 ? 'var(--c-amber)' : 'var(--c-mint)';
  const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, 'aria-hidden': 'true' }, [
    svg('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', class: 'donut-track', 'stroke-width': thickness }),
    svg('circle', {
      cx: size / 2,
      cy: size / 2,
      r,
      fill: 'none',
      stroke: tone,
      'stroke-width': thickness,
      'stroke-linecap': 'round',
      'stroke-dasharray': `${Math.max(clamped * c, 0.001)} ${c}`,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      class: 'ring-arc',
    }),
  ]);
  return h('div', { class: 'ring', style: `width:${size}px;height:${size}px` }, [root, h('div', { class: 'ring-center' }, children || [])]);
}

// Vertical columns with rounded tops + dashed average line. Tap a column to
// read its value (there's no hover on phones).
export function columns(items, { color = 'var(--c-mint)', highlightLast = false, highlightMax = false, avg = null, labelEvery = 1, height = 132 } = {}) {
  const max = Math.max(...items.map((i) => i.value), avg || 0, 0.01);
  const peak = highlightMax ? items.reduce((best, item, i) => (item.value > (items[best]?.value || 0) ? i : best), -1) : -1;
  const readout = h('div', { class: 'col-readout' }, ' ');
  const bars = h('div', { class: 'cols', style: `height:${height}px` });
  items.forEach((item, i) => {
    const pct = (item.value / max) * 100;
    const col = h(
      'button',
      {
        type: 'button',
        class: 'col' + (highlightLast && i === items.length - 1 ? ' is-current' : '') + (i === peak ? ' is-peak' : '') + (item.value === 0 ? ' is-zero' : ''),
        'aria-label': `${item.full || item.label}: ${formatCurrency(item.value)}`,
        onClick: () => {
          for (const b of bars.querySelectorAll('.col')) b.classList.remove('is-active');
          col.classList.add('is-active');
          readout.textContent = `${item.full || item.label} · ${formatCurrency(item.value)}`;
        },
      },
      [h('span', { class: 'col-bar', style: `height:${Math.max(pct, item.value > 0 ? 3 : 1.5)}%;--col:${color}` })]
    );
    bars.appendChild(col);
  });
  if (avg != null && avg > 0) {
    bars.appendChild(h('div', { class: 'cols-avg', style: `bottom:${(avg / max) * 100}%` }, [h('span', {}, t('Avg {v}', { v: formatCurrencyCompact(avg) }))]));
  }
  const labels = h(
    'div',
    { class: 'cols-labels' },
    items.map((item, i) => h('span', {}, i % labelEvery === 0 || i === items.length - 1 ? item.label : ''))
  );
  return h('div', { class: 'col-chart' }, [readout, bars, labels]);
}

// Ranked horizontal bars. items: [{label, value, sub?, color?}]
export function barList(items, { color = 'var(--c-mint)', emptyText = t('Nothing here yet.'), total = null } = {}) {
  const wrap = h('div', { class: 'bar-list' });
  if (!items.length) {
    wrap.appendChild(h('p', { class: 'empty-line' }, emptyText));
    return wrap;
  }
  const max = Math.max(...items.map((i) => i.value), 0.01);
  for (const item of items) {
    const pct = Math.max((item.value / max) * 100, 2);
    wrap.appendChild(
      h('div', { class: 'bar-row' }, [
        h('div', { class: 'bar-head' }, [
          h('span', { class: 'bar-label' }, item.label),
          item.sub ? h('span', { class: 'bar-sub' }, item.sub) : null,
          h('span', { class: 'bar-value' }, [
            formatCurrency(item.value),
            total ? h('span', { class: 'bar-share' }, ` ${sharePct(item.value, total)}`) : null,
          ]),
        ]),
        h('div', { class: 'bar-track' }, [h('div', { class: 'bar-fill', style: `width:${pct}%;background:${item.color || color}` })]),
      ])
    );
  }
  return wrap;
}

// "▼ 8% vs September" pill: green when spending went down, amber when up.
// `short` is the compact name shown on the pill (e.g. the month), `previousLabel`
// the full meaning for the tooltip / screen readers.
export function deltaPill(current, previous, previousLabel, short = null) {
  if (previous <= 0) return h('span', { class: 'delta delta-flat' }, t('No data for {p} yet', { p: t(previousLabel) }));
  const diff = current - previous;
  const pct = Math.round((Math.abs(diff) / previous) * 100);
  if (pct === 0) return h('span', { class: 'delta delta-flat' }, t('Same as {p}', { p: t(previousLabel) }));
  const up = diff > 0;
  const full = t(up ? '{pct}% more vs {p}' : '{pct}% less vs {p}', { pct, p: t(previousLabel) });
  return h('span', { class: 'delta ' + (up ? 'delta-up' : 'delta-down'), title: full, 'aria-label': full }, [
    h('span', { class: 'delta-arrow', 'aria-hidden': 'true' }, up ? '▲' : '▼'),
    short ? t('{pct}% vs {p}', { pct, p: short }) : full,
  ]);
}

// Line chart for a short series (the last 6 months): dots on each value, the
// highest one labelled, the last (current) one in amber. Tap a dot to read it.
export function lineChart(items, { height = 150, color = 'var(--c-lilac)' } = {}) {
  const W = 320;
  const H = height;
  const padX = 18;
  const top = 26;
  const bottom = 26;
  const max = Math.max(...items.map((i) => i.value), 0.01);
  const x = (i) => padX + (items.length > 1 ? (i * (W - padX * 2)) / (items.length - 1) : (W - padX * 2) / 2);
  const y = (v) => top + (1 - v / max) * (H - top - bottom);
  const readout = h('div', { class: 'col-readout' }, ' ');
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'line-svg', role: 'img', 'aria-label': items.map((i) => `${i.full || i.label}: ${formatCurrency(i.value)}`).join(', ') });
  for (let g = 0; g <= 2; g++) {
    const gy = top + (g * (H - top - bottom)) / 2;
    root.appendChild(svg('line', { x1: padX, x2: W - padX, y1: gy, y2: gy, class: 'line-grid' }));
  }
  const pts = items.map((item, i) => [x(i), y(item.value)]);
  root.appendChild(svg('path', { d: pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' '), class: 'line-path', style: `--series:${color}` }));
  const peak = items.reduce((best, item, i) => (item.value > items[best].value ? i : best), 0);
  items.forEach((item, i) => {
    const [px, py] = pts[i];
    const last = i === items.length - 1;
    root.appendChild(svg('circle', { cx: px, cy: py, r: last ? 6 : 4.5, class: 'line-dot' + (last ? ' is-current' : ''), style: `--series:${color}` }));
    if (i === peak && item.value > 0) {
      root.appendChild(svg('text', { x: px, y: py - 12, class: 'line-peak', 'text-anchor': 'middle' }, [document.createTextNode(formatCurrencyCompact(item.value))]));
    }
    root.appendChild(svg('text', { x: px, y: H - 6, class: 'line-label' + (last ? ' is-current' : ''), 'text-anchor': 'middle' }, [document.createTextNode(item.label)]));
    const hit = svg('circle', { cx: px, cy: py, r: 18, class: 'line-hit', tabindex: '0', role: 'button', 'aria-label': `${item.full || item.label}: ${formatCurrency(item.value)}` });
    const show = () => (readout.textContent = `${item.full || item.label} · ${formatCurrency(item.value)}`);
    hit.addEventListener('click', show);
    hit.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && show());
    root.appendChild(hit);
  });
  return h('div', { class: 'line-chart' }, [readout, root]);
}
