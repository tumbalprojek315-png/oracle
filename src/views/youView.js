// The "You" tab: profile, preferences, notifications, money settings, data
// (sync & export) and about/legal. Order follows common app settings:
// who you are → how the app looks → reminders → money setup → your data →
// about & legal, with the destructive "Delete all data" last.
//
// Sub-pages (#you/notifications, #you/sync, …) open inside the tab with a
// back button and work with the browser/phone back gesture.
import { h, clear } from '../dom.js';
import {
  getEntries,
  getSettings,
  updateSettings,
  subscribe,
  subscribeSettings,
  addCategory,
  renameCategory,
  deleteCategory,
  undoDeleteCategory,
  countCategoryEntries,
  addPaymentMethod,
  renamePaymentMethod,
  deletePaymentMethod,
  undoDeletePaymentMethod,
  countPaymentEntries,
  eraseAllData,
} from '../store.js';
import { TYPES, categoriesForType, paymentMethods, typeLabel } from '../categories.js';
import { currencySymbol, formatCurrency } from '../format.js';
import { chipGroup } from '../components/chips.js';
import { editableList } from '../components/editableList.js';
import { toast, confirmDialog } from '../components/sheet.js';
import { icon } from '../icons.js';
import { t, tn, lang, LANGUAGES } from '../i18n.js';
import { APP } from '../config.js';
import { legalPage } from '../legal.js';
import { createSyncView } from './syncView.js';
import {
  notificationSettings,
  updateNotificationSettings,
  notificationSupport,
  permissionState,
  requestPermission,
  reminderPlan,
  mealTimeOptions,
  nextReminder,
  sendTest,
} from '../notifications.js';
import { startTour, CHAPTERS } from '../tour.js';

// Store messages are English; translate the known ones (incl. "“X” already exists.").
function trErr(msg) {
  if (!msg) return msg;
  const m = /^“(.+)” already exists\.$/.exec(msg);
  return m ? t('“{name}” already exists.', { name: m[1] }) : t(msg);
}

const TEXT_SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
];

export function createYouView({ navigate } = {}) {
  const root = h('div', { class: 'view view-you' });
  const sync = createSyncView();
  let page = 'main';

  // ---- small building blocks ----
  // key: a stable name for the guided tour to find the section (titles are translated)
  function section(title, rows, foot, key = title) {
    return h('section', { class: 'set-section', 'data-sec': key || '' }, [
      title ? h('h2', { class: 'set-section-title' }, t(title)) : null,
      h('div', { class: 'set-list glass' }, rows.filter(Boolean)),
      foot ? h('p', { class: 'set-foot' }, foot) : null,
    ]);
  }

  // A tappable row: icon, label (+ optional sub-line), current value, chevron.
  function row({ iconName, color = 'var(--c-mint)', label, sub, value, onClick, danger = false, external = false }) {
    return h('button', { type: 'button', class: 'set-row' + (danger ? ' is-danger' : ''), onClick }, [
      h('span', { class: 'set-icon', style: `--set-icon:${danger ? 'var(--danger)' : color}` }, icon(iconName, 18)),
      h('span', { class: 'set-text' }, [h('span', { class: 'set-label' }, label), sub ? h('span', { class: 'set-sub' }, sub) : null]),
      value != null ? h('span', { class: 'set-value' }, value) : null,
      icon(external ? 'arrowRight' : 'chevronRight', 16),
    ]);
  }

  // A row with a control on the right (switch, segmented…), not tappable itself.
  function controlRow({ iconName, color = 'var(--c-mint)', label, sub, control, stacked = false }) {
    return h('div', { class: 'set-row set-row-control' + (stacked ? ' is-stacked' : '') }, [
      h('span', { class: 'set-icon', style: `--set-icon:${color}` }, icon(iconName, 18)),
      h('span', { class: 'set-text' }, [h('span', { class: 'set-label' }, label), sub ? h('span', { class: 'set-sub' }, sub) : null]),
      control,
    ]);
  }

  function toggle(on, onChange, label) {
    const btn = h(
      'button',
      {
        type: 'button',
        class: 'switch' + (on ? ' is-on' : ''),
        role: 'switch',
        'aria-checked': String(on),
        'aria-label': label,
        onClick: async () => {
          btn.disabled = true;
          try {
            await onChange(!on);
          } finally {
            btn.disabled = false;
          }
        },
      },
      [h('span', { class: 'switch-knob' })]
    );
    return btn;
  }

  function seg(options, value, onChange, label) {
    return chipGroup({ variant: 'seg', options: options.map((o) => ({ ...o, label: t(o.label) })), value, ariaLabel: label, onChange });
  }

  // Through the app router, so the URL, back gesture and the You tab button
  // all agree on which page is open.
  function open(next) {
    if (page === next) return;
    navigate(next === 'main' ? 'you' : `you/${next}`);
  }

  function show(next) {
    page = next;
    render();
    window.scrollTo({ top: 0 });
  }

  function subHeader(title) {
    return h('header', { class: 'sub-head' }, [
      h('button', { type: 'button', class: 'orb-btn', 'aria-label': t('Back'), onClick: () => history.back() }, icon('chevronLeft', 20)),
      h('h1', { class: 'sub-title' }, title),
    ]);
  }

  // ---- main page ----
  function renderMain() {
    const s = getSettings();
    const n = notificationSettings();
    const count = getEntries().length;
    const name = (s.name || '').trim();

    // Profile
    const nameInput = h('input', {
      type: 'text',
      class: 'profile-name-input',
      value: name,
      maxlength: 40,
      placeholder: t('Add your name'),
      'aria-label': t('Your name'),
      autocomplete: 'given-name',
      onChange: async (e) => {
        await updateSettings({ name: e.target.value.trim() }, { touch: false });
        toast(t('Name saved'));
      },
      onKeydown: (e) => e.key === 'Enter' && e.target.blur(),
    });
    root.appendChild(
      h('section', { class: 'profile glass' }, [
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, name ? name[0].toUpperCase() : icon('user', 26)),
        h('div', { class: 'profile-text' }, [
          nameInput,
          h('p', { class: 'profile-sub' }, t('{n} · local only', { n: tn(count, 'entry', 'entries') })),
        ]),
        // the guided tour, right where people look first
        h('button', { type: 'button', class: 'pill-btn pill-sm profile-tour', 'aria-label': t('Help guide'), onClick: () => open('guide') }, [icon('book', 15), h('span', {}, t('Tour'))]),
      ])
    );

    // Preferences
    root.appendChild(
      section('Appearance', [
        controlRow({
          iconName: 'moon',
          color: 'var(--c-lilac)',
          label: t('Theme'),
          stacked: true,
          control: seg(
            [
              { value: 'auto', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ],
            s.theme || 'auto',
            (v) => updateSettings({ theme: v }, { touch: false }),
            t('Theme')
          ),
        }),
        controlRow({
          iconName: 'text',
          color: 'var(--c-blue)',
          label: t('Text size'),
          stacked: true,
          control: seg(TEXT_SIZES, s.textSize === 'xlarge' ? 'large' : s.textSize || 'default', (v) => updateSettings({ textSize: v }, { touch: false }), t('Text size')),
        }),
        controlRow({
          iconName: 'globe',
          color: 'var(--c-mint)',
          label: t('Language'),
          stacked: true,
          control: seg(
            LANGUAGES.map((l) => ({ value: l.code, label: l.short })),
            lang(),
            (v) => updateSettings({ language: v }, { touch: false }),
            t('Language')
          ),
        }),
      ])
    );

    // Notifications
    root.appendChild(
      section('Notifications', [
        row({
          iconName: 'bell',
          color: 'var(--c-amber)',
          label: t('Reminders'),
          sub: t('Meal reminders and a daily check-in'),
          value: n.enabled ? t('On') : t('Off'),
          onClick: () => open('notifications'),
        }),
      ])
    );

    // Money
    const catCount = TYPES.reduce((sum, ty) => sum + categoriesForType(ty.key).length, 0);
    root.appendChild(
      section('Money', [
        row({ iconName: 'target', color: 'var(--c-mint)', label: t('Monthly budget'), value: s.monthlyBudget ? formatCurrency(s.monthlyBudget) : t('Not set'), onClick: () => open('budget') }),
        row({ iconName: 'tag', color: 'var(--c-blue)', label: t('Categories'), value: String(catCount), onClick: () => open('categories') }),
        row({ iconName: 'card', color: 'var(--c-lilac)', label: t('Payment methods'), value: String(paymentMethods().length), onClick: () => open('payments') }),
      ])
    );

    // Data
    root.appendChild(
      section(
        'Your data',
        [
          row({ iconName: 'sync', color: 'var(--c-mint)', label: t('Sync & export'), sub: t('Move data to another device, Excel, CSV'), onClick: () => open('sync') }),
          (s.excludedLocations?.length || 0) + (s.excludedItemNames?.length || 0)
            ? row({
                iconName: 'undo',
                color: 'var(--c-blue)',
                label: t('Show hidden suggestions'),
                value: String(s.excludedLocations.length + s.excludedItemNames.length),
                onClick: async () => {
                  await updateSettings({ excludedLocations: [], excludedItemNames: [] });
                  toast(t('Suggestions restored'));
                },
              })
            : null,
          row({ iconName: 'trash', label: t('Delete all data'), danger: true, onClick: confirmEraseAll }),
        ],
        t('Your expenses are stored only on this device. Send a sync file regularly as a backup.')
      )
    );

    // About & legal
    root.appendChild(
      section('About & legal', [
        row({ iconName: 'shield', color: 'var(--c-mint)', label: t('Privacy policy'), onClick: () => open('privacy') }),
        row({ iconName: 'note', color: 'var(--c-blue)', label: t('Terms of use'), onClick: () => open('terms') }),
        row({ iconName: 'info', color: 'var(--c-amber)', label: t('Financial disclaimer'), onClick: () => open('disclaimer') }),
        row({ iconName: 'book', color: 'var(--c-lilac)', label: t('Open-source licenses'), onClick: () => open('licenses') }),
        APP.supportEmail
          ? row({ iconName: 'mail', color: 'var(--c-blue)', label: t('Contact support'), value: APP.supportEmail, external: true, onClick: () => (location.href = `mailto:${APP.supportEmail}?subject=${encodeURIComponent('Oracle ' + APP.version)}`) })
          : null,
      ])
    );

    root.appendChild(
      h('footer', { class: 'you-foot' }, [
        h('span', { class: 'you-foot-name' }, 'Oracle'),
        h('span', {}, t('Version {v}', { v: `${APP.version} (${APP.build})` })),
        h('span', {}, t('Offline-first expense tracker')),
      ])
    );
  }

  async function confirmEraseAll() {
    const count = getEntries().length;
    const ok = await confirmDialog({
      title: t('Delete all data?'),
      message: t('This permanently erases all {n}, your categories, payment methods, budget and settings from this device. It can’t be undone. Send a sync file first if you want a backup.', { n: tn(count, 'expense', 'expenses') }),
      acknowledge: t('I understand everything on this device will be erased.'),
      confirmLabel: t('Delete everything'),
      danger: true,
    });
    if (!ok) return;
    await eraseAllData();
    toast(t('All data deleted'));
    history.replaceState(null, '', '#home');
    location.reload();
  }

  // ---- sub-pages ----
  function renderBudget() {
    const s = getSettings();
    root.appendChild(subHeader(t('Monthly budget')));
    const input = h('input', {
      type: 'number',
      inputmode: 'decimal',
      min: '0',
      step: '1',
      class: 'input',
      placeholder: t('Your monthly budget'),
      value: s.monthlyBudget || '',
      'aria-label': t('Monthly budget'),
      onChange: async (e) => {
        const v = Math.max(0, Math.round(Number(e.target.value) || 0));
        await updateSettings({ monthlyBudget: v });
        toast(v ? t('Budget saved') : t('Budget removed'));
      },
    });
    root.appendChild(
      h('div', { class: 'glass card' }, [
        h('div', { class: 'input-wrap' }, [h('span', { class: 'input-prefix' }, currencySymbol()), input]),
        h('p', { class: 'hint' }, t('Home shows how much is left this month. The budget counts the types selected in Insights → Count in totals. Leave empty for no budget.')),
      ])
    );
  }

  function renderCategories() {
    root.appendChild(subHeader(t('Categories')));
    let catType = 'non_food';
    const list = editableList({
      placeholder: t('New category'),
      items: () => categoriesForType(catType),
      add: (v) => addCategory(catType, v).then(trErr),
      rename: (from, to) => renameCategory(catType, from, to).then(trErr),
      remove: async (name) => {
        const { count, total } = countCategoryEntries(catType, name);
        const ok = await confirmDialog({
          title: t('Delete “{name}”?', { name }),
          message: count
            ? t('The {type} category “{name}” and its {n} ({amount}) will be permanently deleted. You get a few seconds to undo.', { type: t(typeLabel(catType)), name, n: tn(count, 'expense', 'expenses'), amount: formatCurrency(total) })
            : t('The {type} category “{name}” will be deleted. No expenses are logged in it.', { type: t(typeLabel(catType)), name }),
          acknowledge: count ? t('I understand “{name}” and its {n} will be permanently deleted.', { name, n: tn(count, 'expense', 'expenses') }) : null,
          confirmLabel: t('Delete'),
          danger: true,
        });
        if (!ok) return null;
        const undo = await deleteCategory(catType, name);
        return { message: t('Deleted “{name}”', { name }), undo: () => undoDeleteCategory(undo) };
      },
    });
    const typeSeg = chipGroup({
      variant: 'seg',
      options: TYPES.map((ty) => ({ value: ty.key, label: t(ty.label) })),
      value: catType,
      ariaLabel: t('Category type'),
      onChange: (v) => {
        catType = v;
        list.reset();
      },
    });
    root.appendChild(h('div', { class: 'glass card' }, [typeSeg, list.root, h('p', { class: 'hint' }, t('Tap the pencil on one to rename or delete it.'))]));
    pageRefresh = () => list.render();
  }

  function renderPayments() {
    root.appendChild(subHeader(t('Payment methods')));
    const list = editableList({
      placeholder: t('New payment method'),
      items: () => paymentMethods(),
      add: (v) => addPaymentMethod(v).then(trErr),
      rename: (from, to) => renamePaymentMethod(from, to).then(trErr),
      remove: async (name) => {
        const { count } = countPaymentEntries(name);
        const ok = await confirmDialog({
          title: t('Remove “{name}”?', { name }),
          message: count
            ? t('It won’t be offered when you log new expenses. {n} already paid with “{name}” keep it.', { n: tn(count, 'expense', 'expenses'), name })
            : t('It won’t be offered when you log new expenses.'),
          confirmLabel: t('Remove'),
          danger: true,
        });
        if (!ok) return null;
        const undo = await deletePaymentMethod(name);
        return { message: t('Removed “{name}”', { name }), undo: () => undoDeletePaymentMethod(undo) };
      },
    });
    root.appendChild(h('div', { class: 'glass card' }, [list.root, h('p', { class: 'hint' }, t('Tap the pencil on one to rename or remove it.'))]));
    pageRefresh = () => list.render();
  }

  async function renderNotifications() {
    const token = renderToken;
    const n = notificationSettings();
    const support = notificationSupport();
    const perm = await permissionState();
    // a newer render started while waiting (e.g. the switch saved a setting): let that one draw
    if (token !== renderToken || page !== 'notifications') return;
    root.appendChild(subHeader(t('Notifications')));

    const body = h('div', { class: 'you-stack' });
    root.appendChild(body);

    const statusText =
      support === 'unsupported'
        ? t('This browser can’t show notifications.')
        : perm === 'denied'
          ? t('Notifications are blocked for Oracle. Allow them in your browser or phone settings, then come back.')
          : perm === 'granted'
            ? t('Notifications are allowed.')
            : t('Oracle will ask for permission when you turn reminders on.');

    body.appendChild(
      section(
        null,
        [
          controlRow({
            iconName: 'bell',
            color: 'var(--c-amber)',
            label: t('Turn on reminders'),
            sub: t('Nudges you to log a meal you haven’t logged yet, plus an evening check-in.') + ' ' + statusText,
            control: toggle(
              n.enabled && perm === 'granted',
              async (on) => {
                if (on) {
                  const result = perm === 'granted' ? 'granted' : await requestPermission();
                  if (result !== 'granted') {
                    toast(result === 'denied' ? t('Notifications are blocked. Allow them in settings.') : t('Notifications aren’t available here.'));
                    render();
                    return;
                  }
                }
                await updateNotificationSettings({ enabled: on });
                toast(on ? t('Reminders on') : t('Reminders off'));
              },
              t('Turn on reminders')
            ),
          }),
        ],
        support === 'web' ? t('In the browser, reminders arrive while Oracle is open or running in the background. In the App Store version they arrive even when the app is closed.') : null
      )
    );

    const on = n.enabled && perm === 'granted';
    const plan = reminderPlan();
    body.appendChild(
      section(
        'Meal reminders',
        plan.map((m) => mealBlock(m)),
        t('These times are only used to remind you to log what you spent. A reminder is sent an hour after the meal, and only if you haven’t logged it yet. Turn off a meal you usually skip.')
      )
    );

    const timeInput = h('input', {
      type: 'time',
      class: 'input input-time-sm',
      value: n.summaryTime,
      'aria-label': t('Check-in time'),
      onChange: (e) => e.target.value && updateNotificationSettings({ summaryTime: e.target.value }),
    });
    body.appendChild(
      section('Daily check-in', [
        controlRow({
          iconName: 'calendar',
          color: 'var(--c-blue)',
          label: t('Evening check-in'),
          sub: t('A nudge to log anything you missed today.'),
          control: toggle(n.dailySummary, (v) => updateNotificationSettings({ dailySummary: v }), t('Evening check-in')),
        }),
        controlRow({ iconName: 'clock', color: 'var(--c-blue)', label: t('Time'), control: timeInput }),
      ])
    );

    body.appendChild(
      section(
        'Privacy',
        [
          controlRow({
            iconName: 'shield',
            color: 'var(--c-mint)',
            label: t('Show amounts in notifications'),
            sub: t('Off keeps your spending private on the lock screen.'),
            control: toggle(n.showAmounts, (v) => updateNotificationSettings({ showAmounts: v }), t('Show amounts in notifications')),
          }),
        ]
      )
    );

    // Check it works: what's next, plus a test now or in 10 seconds (time to
    // minimise the browser and see it arrive in the background).
    if (on) {
      const next = await nextReminder();
      if (token !== renderToken) return;
      body.appendChild(
        section('Check', [
          controlRow({
            iconName: 'clock',
            color: 'var(--c-blue)',
            label: t('Next reminder'),
            sub: next
              ? t(next.tomorrow ? '{what} tomorrow at {time}' : '{what} today at {time}', { what: t(next.label), time: next.time })
              : t('None: all meals are turned off.'),
          }),
        ])
      );
    }
    const testBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-block', disabled: !on }, [icon('bell', 18), h('span', {}, t('Send a test notification'))]);
    testBtn.addEventListener('click', async () => {
      const ok = await sendTest();
      toast(ok ? t('Test sent. Check your notifications.') : t('Couldn’t send. Are notifications allowed?'));
    });
    const laterBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-block', disabled: !on }, [icon('clock', 18), h('span', {}, t('Test in 10 seconds'))]);
    laterBtn.addEventListener('click', async () => {
      laterBtn.disabled = true;
      toast(t('Minimise the browser now. The test arrives in 10 seconds.'));
      const ok = await sendTest(10000);
      laterBtn.disabled = false;
      if (!ok) toast(t('Couldn’t send. Are notifications allowed?'));
    });
    body.appendChild(
      h('div', { class: 'you-actions' }, [
        testBtn,
        laterBtn,
        on ? h('p', { class: 'hint center' }, t('Nothing appeared? Check that notifications for your browser are on in your computer or phone settings, and that Do Not Disturb / Focus is off.')) : h('p', { class: 'hint center' }, t('Turn reminders on to send a test.')),
      ])
    );
  }

  // One meal in the reminders list: on/off ("I usually skip it" = off), the
  // time you usually eat (30-minute steps) and Oracle's suggestion from your logs.
  function mealBlock(m) {
    const setMeal = (patch) => {
      const cur = notificationSettings();
      return updateNotificationSettings({ meals: { ...cur.meals, ...(patch.meals || {}) }, mealTimes: { ...cur.mealTimes, ...(patch.mealTimes || {}) } });
    };
    const iconName = m.key === 'pagi' ? 'sun' : m.key === 'siang' ? 'food' : 'moon';
    const color = m.key === 'pagi' ? 'var(--c-amber)' : m.key === 'siang' ? 'var(--c-mint)' : 'var(--c-lilac)';
    const head = controlRow({
      iconName,
      color,
      label: t(m.label),
      sub: m.enabled ? t('Reminder at {at} if nothing is logged', { at: m.at }) : t('Off: you usually skip {meal}', { meal: t(m.label).toLowerCase() }),
      control: toggle(m.enabled, (v) => setMeal({ meals: { [m.key]: v } }), t(m.label)),
    });
    if (!m.enabled) return head;

    const select = h(
      'select',
      {
        class: 'input meal-select',
        'aria-label': t('{meal} time', { meal: t(m.label) }),
        onChange: (e) => setMeal({ mealTimes: { [m.key]: e.target.value } }),
      },
      mealTimeOptions(m.key).map((v) => h('option', { value: v, selected: v === m.eat }, v))
    );
    if (!mealTimeOptions(m.key).includes(m.eat)) select.prepend(h('option', { value: m.eat, selected: true }, m.eat));

    const s = m.suggestion;
    let suggest;
    if (!s.time) {
      suggest = h('p', { class: 'meal-suggest' }, [
        icon('spark', 14),
        h('span', {}, t('Log a few meals and Oracle will suggest your usual time ({n} of 3 so far).', { n: Math.min(s.count, 2) })),
      ]);
    } else if (s.time === m.eat) {
      suggest = h('p', { class: 'meal-suggest is-match' }, [
        icon('check', 14),
        h('span', {}, t('Matches your logs: you most often eat around {time} ({n}).', { time: s.time, n: tn(s.count, 'meal', 'meals') })),
      ]);
    } else {
      suggest = h('p', { class: 'meal-suggest' }, [
        icon('spark', 14),
        h('span', {}, t('From your logs you most often eat around {time} ({n}).', { time: s.time, n: tn(s.count, 'meal', 'meals') })),
        h('button', { type: 'button', class: 'meal-use', onClick: () => setMeal({ mealTimes: { [m.key]: s.time } }) }, t('Use {time}', { time: s.time })),
      ]);
    }

    return h('div', { class: 'meal-block' }, [
      head,
      h('div', { class: 'meal-detail' }, [h('label', { class: 'meal-time-row' }, [h('span', {}, t('I usually eat at')), select]), suggest]),
    ]);
  }

  // Help guide: the full tour, or one use case at a time.
  function renderGuide() {
    root.appendChild(subHeader(t('Help guide')));
    const back = () => navigate('you/guide');
    root.appendChild(
      h('section', { class: 'guide-hero glass' }, [
        h('span', { class: 'guide-hero-icon', 'aria-hidden': 'true' }, icon('book', 26)),
        h('h2', { class: 'guide-hero-title' }, t('Take the full tour')),
        h('p', { class: 'hint' }, t('Oracle shows you every button, one step at a time, on the real screens. Go back or forward whenever you like.')),
        h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => startTour({ onDone: back }) }, [icon('arrowRight', 18), h('span', {}, t('Start the tour'))]),
      ])
    );
    root.appendChild(
      section(
        'Learn one thing',
        CHAPTERS.map((c) =>
          row({
            iconName: c.icon,
            color: c.color,
            label: t(c.title),
            sub: `${t(c.sub)} · ${t('{n} steps', { n: c.steps.filter((x) => !x.needsData || getEntries().length).length })}`,
            onClick: () => startTour({ chapters: [c.key], onDone: back }),
          })
        )
      )
    );
  }

  function renderSync() {
    root.appendChild(subHeader(t('Sync & export')));
    root.appendChild(sync.root);
    sync.root.hidden = false;
    sync.activate();
  }

  function renderLegal(key) {
    const doc = legalPage(key);
    root.appendChild(subHeader(doc.title));
    const article = h('article', { class: 'legal glass' }, [doc.intro ? h('p', { class: 'legal-intro' }, doc.intro) : null]);
    for (const sec of doc.sections) {
      article.appendChild(h('h2', { class: 'legal-h' }, sec.heading));
      for (const part of sec.body) {
        article.appendChild(Array.isArray(part) ? h('ul', {}, part.map((li) => h('li', {}, li))) : h('p', {}, part));
      }
    }
    root.appendChild(article);
  }

  // ---- render ----
  let pageRefresh = null;
  let renderToken = 0;
  function render() {
    renderToken++;
    pageRefresh = null;
    if (sync.root.parentNode === root) sync.root.remove();
    clear(root);
    if (page === 'main') {
      root.appendChild(h('header', { class: 'view-head' }, [h('div', {}, [h('p', { class: 'eyebrow' }, t('Profile & settings')), h('h1', { class: 'view-title' }, t('You'))])]));
      renderMain();
    } else if (page === 'budget') renderBudget();
    else if (page === 'categories') renderCategories();
    else if (page === 'payments') renderPayments();
    else if (page === 'notifications') renderNotifications();
    else if (page === 'sync') renderSync();
    else if (page === 'guide') renderGuide();
    else if (['privacy', 'terms', 'disclaimer', 'licenses'].includes(page)) renderLegal(page);
    else {
      page = 'main';
      render();
    }
  }

  // Re-render on changes, but don't rebuild while someone is typing in a field.
  const refresh = () => {
    if (root.hidden) return;
    if (root.contains(document.activeElement) && document.activeElement.matches('input, textarea')) return;
    if (pageRefresh) pageRefresh();
    else if (page !== 'sync') render();
  };
  subscribe(refresh);
  subscribeSettings(refresh);

  return {
    root,
    // `sub` comes from the URL (#you/notifications)
    activate(sub) {
      show(sub || 'main');
    },
    deactivate() {},
    open,
  };
}
