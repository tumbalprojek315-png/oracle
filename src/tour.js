// Guided tour: walks through the real app one control at a time. Each step
// opens the right screen (and the new-expense form when needed), spotlights
// one control and explains it, with Previous / Next. A step can also explain
// several neighbouring parts at once (`parts`): a line draws from each part
// to its own callout, then the callout's text types in. Nothing is saved: the
// example typed into the form is thrown away when the form closes.
//
// The tour is split into chapters (use cases) so the Help guide can replay
// one of them; the first-launch setup runs all of them.
import { h } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { openAddSheet } from './entryActions.js';
import { closeSheet, isSheetOpen } from './components/sheet.js';
import { getEntries } from './store.js';

const $ = (sel) => document.querySelector(sel);
const visible = (el) => el && el.getBoundingClientRect().height > 0;

// Form fields are found by what they contain (labels are translated).
function formField(kind) {
  const fields = [...document.querySelectorAll('#sheet-root .entry-form .field')].filter(visible);
  if (kind === 'category') return fields[0];
  if (kind === 'place') return fields.find((f) => f.querySelector('.text-chip-field'));
  if (kind === 'meal') return fields.find((f) => f.querySelector('.input-time'));
  if (kind === 'paid') return fields.filter((f) => f.querySelector('.chip-group')).at(-1);
  return null;
}

// Home cards: "Recent" holds the expense list (or the empty state); the
// category chart card only shows once there is data.
function homeCard(kind) {
  const cards = [...document.querySelectorAll('.view-home .card')].filter(visible);
  const recent = cards.find((c) => c.querySelector('.entry-row, .empty'));
  return kind === 'recent' ? recent : cards.find((c) => c !== recent);
}

async function typeExample(value) {
  const keys = [...document.querySelectorAll('#sheet-root .keypad .key')];
  const back = keys.find((k) => k.classList.contains('key-back'));
  for (let i = 0; i < 8; i++) back?.click();
  for (const ch of value) {
    await new Promise((r) => setTimeout(r, 170));
    keys.find((k) => k.textContent.trim() === ch)?.click();
  }
}

// route: the screen the step needs; sheet: whether the new-expense form is open.
export const CHAPTERS = [
  {
    key: 'home',
    icon: 'home',
    color: 'var(--c-mint)',
    title: 'Home at a glance',
    sub: 'Your month, budget and latest expenses',
    steps: [
      {
        route: 'home',
        parts: [
          { target: () => $('.view-home .hero'), title: 'This month', text: 'Total spent this month, compared with last month.' },
          { target: () => $('.view-home .stat-strip'), title: 'Quick numbers', text: 'Today, the last 7 days and fixed costs.' },
        ],
      },
      { route: 'home', target: () => $('.view-home .hero button'), title: 'Monthly budget', text: 'Set a budget and this ring shows how much is left and how many days to go.' },
      { route: 'home', needsData: true, optional: true, target: () => homeCard('chart'), title: 'Where it went', text: 'This month split by category. Tap Insights for the full picture.' },
      { route: 'home', target: () => homeCard('recent'), title: 'Recent', text: 'Your latest expenses. Tap one to change or delete it.' },
    ],
  },
  {
    key: 'log',
    icon: 'plus',
    color: 'var(--c-mint)',
    title: 'Log an expense',
    sub: 'Amount, category, place, payment',
    steps: [
      { route: 'home', target: () => $('#addBtn'), title: 'The + button', text: 'Tap + whenever you spend something. It works on every screen. Let’s open it.' },
      { route: 'home', sheet: true, target: () => $('#sheet-root .date-pill'), title: 'Date', text: 'Today by default. Tap it to log something you bought on another day.' },
      { route: 'home', sheet: true, target: () => $('#sheet-root .entry-form .seg'), title: 'Type', text: 'Food for meals and snacks, Non-food for everything else, Fixed for rent and bills.' },
      { route: 'home', sheet: true, target: () => $('#sheet-root .amount-pad'), demo: () => typeExample('12.50'), title: 'Amount', text: 'Type the amount on the keypad. We typed 12.50 as an example.' },
      { route: 'home', sheet: true, target: () => formField('category'), title: 'Category', text: 'Pick a category. You can add your own in You → Categories.' },
      { route: 'home', sheet: true, target: () => formField('place'), title: 'Place', text: 'Where you spent it. Oracle suggests places you have used before.' },
      { route: 'home', sheet: true, target: () => formField('meal'), title: 'Meal time', text: 'Which meal it was. It also tells your reminders that this meal is logged.' },
      { route: 'home', sheet: true, target: () => formField('paid'), title: 'Paid with', text: 'Cash, card or e-wallet. Edit the list in You → Payment methods.' },
      { route: 'home', sheet: true, target: () => $('#sheet-root .save-bar'), title: 'Save', text: '“Save” saves and closes. “Save + next” keeps the form open for the next expense. This example won’t be saved.' },
    ],
  },
  {
    key: 'activity',
    icon: 'list',
    color: 'var(--c-blue)',
    title: 'Find, edit or delete',
    sub: 'Search, filter and fix mistakes',
    steps: [
      { route: 'activity', target: () => $('.dock-btn[data-view="activity"]'), title: 'Activity', text: 'Every expense you have logged, newest first.' },
      { route: 'activity', target: () => $('.view-activity .cal-card'), title: 'Calendar', text: 'What you spent each day: green is a light day, red a heavy one. Tap a day to see only that day.' },
      { route: 'activity', target: () => $('.view-activity .search'), title: 'Search', text: 'Find an expense by item, place, category or note.' },
      { route: 'activity', target: () => $('.view-activity .chip-scroller'), title: 'Filter', text: 'Show only Food, Non-food or Fixed.' },
      { route: 'activity', target: () => $('.view-activity .entry-row') || $('.view-activity .activity-list') || $('.view-activity .empty'), title: 'Change or delete', text: 'Tap an expense to change or delete it. Deleted by mistake? Tap Undo on the message that appears.' },
      { route: 'activity', needsData: true, optional: true, target: () => $('.view-activity .select-btn'), title: 'Select', text: 'Select several expenses to delete them at once.' },
    ],
  },
  {
    key: 'insights',
    icon: 'chart',
    color: 'var(--c-lilac)',
    title: 'See where your money goes',
    sub: 'Periods, totals and charts',
    steps: [
      { route: 'insights', target: () => $('.dock-btn[data-view="insights"]'), title: 'Insights', text: 'Charts and totals of your spending.' },
      { route: 'insights', target: () => $('.view-insights .period-selector'), title: 'Period', text: 'Look at the last 7 days, this month, 3 months or your own dates.' },
      { route: 'insights', target: () => $('.view-insights .count-row'), title: 'Count in totals', text: 'Choose which types are counted. Turn off Fixed to see only your day-to-day spending.' },
      { route: 'insights', target: () => $('.view-insights .insight-grid .summary-top') || $('.view-insights .insight-grid .card'), title: 'Your numbers', text: 'Total, average per day and your biggest expense. Scroll down for categories, meal times, weekdays and top places.' },
    ],
  },
  {
    key: 'reminders',
    icon: 'bell',
    color: 'var(--c-amber)',
    title: 'Set meal reminders',
    sub: 'Get a nudge if you forget to log',
    steps: [
      { route: 'you', target: () => $('.view-you [data-sec="Notifications"] .set-list'), title: 'Notifications', text: 'Reminders live here in the You tab.' },
      { route: 'you/notifications', target: () => $('.view-you .set-section'), title: 'Turn on reminders', text: 'Switch reminders on and allow notifications when your browser or phone asks.' },
      { route: 'you/notifications', target: () => $('.view-you .meal-block'), title: 'Your meal times', text: 'Pick when you usually eat, in 30-minute steps. Skip a meal? Switch it off.' },
      { route: 'you/notifications', target: () => $('.view-you .meal-suggest'), title: 'Suggestion', text: 'After a few meals Oracle suggests your usual time from your logs. Tap “Use” to take it.' },
      { route: 'you/notifications', target: () => $('.view-you .you-actions'), title: 'Test it', text: 'Send a test now, or in 10 seconds so you can minimise the app and check it still arrives.' },
    ],
  },
  {
    key: 'sync',
    icon: 'sync',
    color: 'var(--c-pink)',
    title: 'Move data or export',
    sub: 'Phone ↔ laptop, Excel and CSV',
    steps: [
      { route: 'you', target: () => $('.view-you [data-sec="Your data"] .set-row'), title: 'Your data', text: 'Sync and export are in the You tab.' },
      { route: 'you/sync', target: () => $('.view-sync .btn-stack'), title: '1 · Send', text: 'Save a sync file on this device, then send it to your other device (chat, email, cloud drive).' },
      { route: 'you/sync', target: () => $('.view-sync .dropzone'), title: '2 · Receive', text: 'On the other device, open the file here. Expenses are merged, never duplicated.' },
      { route: 'you/sync', target: () => $('.view-sync .export-grid'), title: 'Export', text: 'Download an Excel workbook or CSV to analyse your spending.' },
    ],
  },
  {
    key: 'settings',
    icon: 'settings',
    color: 'var(--c-blue)',
    title: 'Make it yours',
    sub: 'Look, budget, categories',
    steps: [
      { route: 'you', target: () => $('.view-you .profile'), title: 'Your name', text: 'Tap your name to change it. No account needed.' },
      { route: 'you', target: () => $('.view-you .profile-tour'), title: 'Help guide', text: 'Open this guide again any time, or replay one topic.' },
      { route: 'you', target: () => $('.view-you [data-sec="Appearance"] .set-list'), title: 'Appearance', text: 'Light or dark, text size and language.' },
      { route: 'you', target: () => $('.view-you [data-sec="Money"] .set-list'), title: 'Money', text: 'Your monthly budget, categories and payment methods.' },
    ],
  },
];

const OUTRO = { route: 'home', title: 'You’re ready', text: 'That’s everything. Replay any part in You → Help guide.' };

let active = null;

export function startTour({ chapters = CHAPTERS.map((c) => c.key), onDone } = {}) {
  active?.close();
  const picked = CHAPTERS.filter((c) => chapters.includes(c.key));
  const full = picked.length === CHAPTERS.length;
  const hasData = getEntries().length > 0;
  const steps = [
    // steps that only exist once something is logged are left out up front, so the count never jumps
    ...picked.flatMap((c) => c.steps.filter((s) => !s.needsData || hasData).map((s) => ({ ...s, chapter: c }))),
    ...(full ? [{ ...OUTRO, chapter: null }] : []),
  ];

  let index = 0;
  let target = null;
  let parts = []; // [{ el, box, line, dot }] on a multi-part step
  let raf = 0;
  let token = 0;

  const spot = h('div', { class: 'tour-spot', 'aria-hidden': 'true' });
  const block = h('div', { class: 'tour-block' });
  const counter = h('span', { class: 'tour-count' });
  const chip = h('span', { class: 'tour-chip' });
  const title = h('h2', { class: 'tour-title' });
  const text = h('p', { class: 'tour-text' });
  const prev = h('button', { type: 'button', class: 'btn btn-ghost tour-prev', onClick: () => go(index - 1, -1) }, [icon('chevronLeft', 16), h('span', {}, t('Previous'))]);
  const next = h('button', { type: 'button', class: 'btn btn-primary tour-next', onClick: () => (index === steps.length - 1 ? close(true) : go(index + 1, 1)) });
  const card = h('div', { class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-live': 'polite' }, [
    h('div', { class: 'tour-card-top' }, [chip, counter, h('button', { type: 'button', class: 'tour-close', 'aria-label': t('Close tour'), onClick: () => close(false) }, icon('close', 16))]),
    title,
    text,
    h('div', { class: 'tour-actions' }, [prev, next]),
  ]);
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('class', 'tour-lines');
  lines.setAttribute('aria-hidden', 'true');
  const callouts = h('div', { class: 'tour-callouts' });
  const root = h('div', { class: 'tour' }, [block, spot, lines, callouts, card]);

  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close(false);
    } else if (e.key === 'ArrowRight') next.click();
    else if (e.key === 'ArrowLeft' && index > 0) prev.click();
  }

  async function prepare(step) {
    const want = step.sheet === true;
    if (!want && isSheetOpen()) {
      closeSheet();
      await wait(260);
    }
    const hash = `#${step.route}`;
    if (location.hash !== hash) {
      location.hash = hash;
      await wait(420);
    }
    if (want && !isSheetOpen()) {
      openAddSheet({ type: 'food' });
      await wait(380);
    }
  }

  async function go(i, dir = 1) {
    if (i < 0 || i >= steps.length) return;
    const my = ++token;
    index = i;
    const step = steps[i];
    card.classList.add('is-moving');
    await prepare(step);
    // steps without a target are a centred card (outro); multi-part steps
    // wait for their first part
    const find = step.parts ? step.parts[0].target : step.target;
    let el = null;
    // optional steps get a short look: the screen is already there, so missing means not applicable
    for (let tries = 0, max = step.optional ? 3 : 15; find && tries < max; tries++) {
      el = find();
      if (el && !visible(el)) el = null; // present but hidden counts as missing
      if (el) break;
      await wait(100);
    }
    if (my !== token) return;
    // A step that doesn't apply (e.g. Select with no expenses yet) is dropped,
    // so the "n of total" count stays continuous.
    if (!el && step.optional) {
      steps.splice(i, 1);
      return go(dir > 0 ? i : i - 1, dir);
    }
    target = el;
    clearParts();
    root.classList.toggle('has-parts', !!step.parts);
    if (step.parts) {
      parts = step.parts.map((part) => ({ part, el: part.target() })).filter((x) => visible(x.el));
      parts.forEach(buildPart);
    }
    if (target) {
      target.scrollIntoView({ block: step.parts ? 'start' : 'center' }); // instant: the spotlight animates the move
      if (step.parts) scrollBy(0, -16);
      await wait(60);
      if (my !== token) return;
    }
    // text
    chip.textContent = step.chapter ? t(step.chapter.title) : t('Tour');
    counter.textContent = t('{n} of {total}', { n: i + 1, total: steps.length });
    title.textContent = step.title ? t(step.title) : '';
    text.textContent = step.text ? t(step.text) : '';
    card.classList.toggle('is-compact', !!step.parts); // the callouts carry the words
    prev.disabled = i === 0;
    next.replaceChildren(
      ...(i === steps.length - 1 ? [h('span', {}, t('Finish'))] : [h('span', {}, t('Next')), icon('chevronRight', 16)])
    );
    root.classList.toggle('no-target', !target);
    card.classList.remove('is-moving');
    layout();
    setTimeout(layout, 200); // after the card's text reflows and sheets finish sliding
    setTimeout(layout, 450);
    next.focus({ preventScroll: true });
    if (step.demo && dir >= 0) step.demo();
    if (parts.length) animateParts(my);
  }

  // ---- multi-part steps: a line from each part to its callout ----
  const SVG = 'http://www.w3.org/2000/svg';
  function buildPart(p) {
    p.line = document.createElementNS(SVG, 'path');
    p.line.setAttribute('class', 'tour-line');
    p.line.setAttribute('pathLength', '1'); // so the draw-in works whatever the length
    p.frame = document.createElementNS(SVG, 'rect'); // this part's own outline, drawn with its line
    p.frame.setAttribute('class', 'tour-frame');
    p.frame.setAttribute('pathLength', '1');
    p.dot = document.createElementNS(SVG, 'circle');
    p.dot.setAttribute('class', 'tour-dot');
    p.dot.setAttribute('r', '4');
    lines.append(p.frame, p.line, p.dot);
    const full = t(p.part.text);
    p.typed = h('span', { class: 'tour-typed', 'aria-hidden': 'true' });
    p.box = h('div', { class: 'tour-callout' }, [
      h('strong', { class: 'tour-callout-title' }, t(p.part.title)),
      // the full text keeps the box at its final size while the typed copy fills in
      h('p', { class: 'tour-callout-text' }, [h('span', { class: 'tour-ghost' }, full), p.typed]),
    ]);
    p.full = full;
    callouts.appendChild(p.box);
  }

  function clearParts() {
    parts = [];
    lines.replaceChildren();
    callouts.replaceChildren();
  }

  const LINE_MS = 260;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function animateParts(my) {
    for (const p of parts) {
      if (reduced) {
        p.frame.classList.add('is-drawn');
        p.line.classList.add('is-drawn');
        p.box.classList.add('is-shown');
        p.typed.textContent = p.full;
        continue;
      }
      p.dot.classList.add('is-shown');
      p.frame.classList.add('is-drawn');
      p.line.classList.add('is-drawn');
      await wait(LINE_MS);
      if (my !== token) return;
      p.box.classList.add('is-shown');
      typeText(p, my); // the next part's line starts while this one types
      await wait(140);
      if (my !== token) return;
    }
  }

  // Left to right, fast enough to read along: about 0.6 s for a short line.
  function typeText(p, my) {
    const total = p.full.length;
    const duration = Math.min(650, 16 * total);
    const start = performance.now();
    const tick = () => {
      if (my !== token) return;
      const n = Math.min(total, Math.ceil(((performance.now() - start) / duration) * total));
      p.typed.textContent = p.full.slice(0, n);
      if (n < total) setTimeout(tick, 16);
    };
    tick();
  }

  // Follow the target every frame (sheets slide, pages scroll, fonts load),
  // and also on scroll / resize for when frames aren't being drawn.
  function track() {
    raf = requestAnimationFrame(track);
    layout();
  }

  function layout() {
    const vw = innerWidth;
    const vh = innerHeight;
    const app = $('#app').getBoundingClientRect();
    const w = Math.min(360, app.width - 32, vw - 32);
    card.style.width = `${w}px`;
    const ch = card.offsetHeight;
    const cardLeft = Math.max(16, app.left + (app.width - w) / 2);
    let top;
    if (parts.length && parts.every((p) => p.el.isConnected)) {
      layoutParts({ vw, vh, w, ch, cardLeft });
      return;
    }
    if (target && target.isConnected) {
      const r = target.getBoundingClientRect();
      const pad = 6;
      const rect = { top: Math.max(4, r.top - pad), left: Math.max(4, r.left - pad), bottom: Math.min(vh - 4, r.bottom + pad), right: Math.min(vw - 4, r.right + pad) };
      const radius = Math.min(28, parseFloat(getComputedStyle(target).borderTopLeftRadius) + pad || 14);
      Object.assign(spot.style, { top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.right - rect.left}px`, height: `${rect.bottom - rect.top}px`, borderRadius: `${radius}px` });
      if (vh - rect.bottom - 14 >= ch + 8) top = rect.bottom + 14;
      else if (rect.top - 14 >= ch + 8) top = rect.top - 14 - ch;
      else top = vh - ch - 16;
    } else {
      top = (vh - ch) / 2;
    }
    card.style.top = `${Math.max(12, Math.min(top, vh - ch - 12))}px`;
    card.style.left = `${cardLeft}px`;
  }

  // One spotlight around all the parts; under it a callout per part, then
  // the card with the buttons. Lines run down the side gutters (first part
  // on the left, second on the right…) into the side of each callout.
  function layoutParts({ vw, vh, w, ch, cardLeft }) {
    const pad = 6;
    const rects = parts.map((p) => p.el.getBoundingClientRect());
    const u = {
      top: Math.min(...rects.map((r) => r.top)) - pad,
      left: Math.min(...rects.map((r) => r.left)) - pad,
      bottom: Math.max(...rects.map((r) => r.bottom)) + pad,
      right: Math.max(...rects.map((r) => r.right)) + pad,
    };
    Object.assign(spot.style, { top: `${u.top}px`, left: `${u.left}px`, width: `${u.right - u.left}px`, height: `${u.bottom - u.top}px`, borderRadius: '24px' });

    const gap = 12;
    const heights = parts.map((p) => {
      p.box.style.width = `${w}px`;
      return p.box.offsetHeight;
    });
    const stack = heights.reduce((a, b) => a + b + gap, 0) + ch;
    let y = vh - u.bottom - 20 >= stack ? u.bottom + 20 : Math.max(12, u.top - 20 - stack);
    const cardRight = cardLeft + w;
    parts.forEach((p, i) => {
      p.box.style.left = `${cardLeft}px`;
      p.box.style.top = `${y}px`;
      const r = rects[i];
      const fp = 4; // frame padding
      const radius = (parseFloat(getComputedStyle(p.el).borderTopLeftRadius) || 12) + fp;
      p.frame.setAttribute('x', r.left - fp);
      p.frame.setAttribute('y', r.top - fp);
      p.frame.setAttribute('width', r.width + fp * 2);
      p.frame.setAttribute('height', r.height + fp * 2);
      p.frame.setAttribute('rx', Math.min(radius, 28));
      const left = i % 2 === 0;
      const x0 = left ? r.left - fp : r.right + fp;
      const y0 = r.top + r.height / 2;
      const gx = left ? Math.max(5, Math.min(x0, cardLeft) - 9) : Math.min(vw - 5, Math.max(x0, cardRight) + 9);
      const yc = y + 22; // level with the callout's title
      p.line.setAttribute('d', `M${x0} ${y0} H${gx} V${yc} H${left ? cardLeft : cardRight}`);
      p.dot.setAttribute('cx', x0);
      p.dot.setAttribute('cy', y0);
      y += heights[i] + gap;
    });
    card.style.left = `${cardLeft}px`;
    card.style.top = `${Math.min(y, vh - ch - 12)}px`;
  }

  function close(finished) {
    if (!active) return;
    active = null;
    cancelAnimationFrame(raf);
    token++;
    document.removeEventListener('keydown', onKey, true);
    removeEventListener('resize', layout);
    removeEventListener('scroll', layout, true);
    clearParts();
    root.classList.add('is-leaving');
    setTimeout(() => root.remove(), 220);
    if (isSheetOpen()) closeSheet(); // drops the example
    onDone?.({ finished });
  }

  active = { close: () => close(false) };
  document.addEventListener('keydown', onKey, true);
  addEventListener('resize', layout);
  addEventListener('scroll', layout, true);
  document.body.appendChild(root);
  track();
  go(0);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
