// First launch: a full-screen setup, one question per screen (the pattern
// most App Store apps use: short, skippable, permission asked only after
// explaining why).
//
//   welcome (language) → name → guided tour of the app → theme → reminders
//   → meal times* → done
//   * only when reminders were turned on and allowed
//
// Everything chosen here can be changed later in the You tab. Nothing is
// required: "Skip" jumps to the end with what was chosen so far, but still
// shows the tour first if it hasn't run yet. You → Help guide replays it.
import { h, clear } from '../dom.js';
import { getSettings, updateSettings } from '../store.js';
import { openSheet, toast } from '../components/sheet.js';
import { icon } from '../icons.js';
import { t, lang, LANGUAGES } from '../i18n.js';
import { legalPage } from '../legal.js';
import { startTour } from '../tour.js';
import {
  REMINDER_MEALS,
  mealTimeOptions,
  minutesToHHMM,
  notificationSettings,
  updateNotificationSettings,
  notificationSupport,
  requestPermission,
} from '../notifications.js';

const MEAL_LOOK = {
  pagi: { icon: 'sun', color: 'var(--c-amber)' },
  siang: { icon: 'food', color: 'var(--c-mint)' },
  malam: { icon: 'moon', color: 'var(--c-lilac)' },
};

const LOGO =
  '<svg viewBox="0 0 32 32" width="64" height="64"><g class="mark-orbit"><path d="M17.87 7.2A9 9 0 1 0 24.8 14.13" fill="none" stroke="var(--c-mint)" stroke-width="3.4" stroke-linecap="round"/><circle class="mark-dot" cx="22.36" cy="9.64" r="2.4" fill="var(--c-amber)"/></g></svg>';

export function openOnboarding() {
  const s = getSettings();
  const n = notificationSettings();
  const state = {
    name: s.name || '',
    remindersOn: false,
    tourDone: false,
    meals: { ...n.meals },
    mealTimes: Object.fromEntries(REMINDER_MEALS.map((m) => [m.key, n.mealTimes[m.key] || minutesToHHMM(m.fallback)])),
  };
  let step = 'welcome';
  let direction = 1;

  const steps = () => ['welcome', 'name', 'theme', 'notify', ...(state.remindersOn ? ['meals'] : []), 'done'];
  const QUESTIONS = ['name', 'theme', 'notify', 'meals'];

  const top = h('header', { class: 'onb-top' });
  const body = h('main', { class: 'onb-body' });
  const foot = h('footer', { class: 'onb-foot' });
  const overlay = h('div', { class: 'onb', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Set up Oracle') }, [
    h('div', { class: 'onb-inner' }, [top, body, foot]),
  ]);

  function go(next) {
    const list = steps();
    direction = list.indexOf(next) >= list.indexOf(step) ? 1 : -1;
    step = next;
    render();
  }
  const nextStep = () => (step === 'name' && !state.tourDone ? runTour('theme') : go(steps()[steps().indexOf(step) + 1]));

  // The guided tour runs on the real app, so the setup steps out of the way
  // and comes back afterwards (at `then`).
  async function runTour(then) {
    await updateSettings({ name: state.name.trim() }, { touch: false });
    state.tourDone = true;
    overlay.hidden = true;
    document.body.classList.remove('has-onb');
    startTour({
      onDone: () => {
        location.hash = '#home';
        overlay.hidden = false;
        document.body.classList.add('has-onb');
        go(then);
      },
    });
  }
  const prevStep = () => go(steps()[Math.max(0, steps().indexOf(step) - 1)]);

  async function finish() {
    await updateSettings({ name: state.name.trim(), onboarded: true }, { touch: false });
    overlay.classList.add('is-leaving');
    document.body.classList.remove('has-onb');
    setTimeout(() => overlay.remove(), 260);
  }

  // ---- pieces ----
  const primary = (label, onClick, extra = {}) => h('button', { type: 'button', class: 'btn btn-primary btn-block onb-cta', onClick, ...extra }, label);
  const secondary = (label, onClick) => h('button', { type: 'button', class: 'onb-secondary', onClick }, label);
  const title = (text, lead) => [h('h1', { class: 'onb-title' }, text), lead ? h('p', { class: 'onb-lead' }, lead) : null];

  function choice({ selected, onClick, children, cls = '' }) {
    return h('button', { type: 'button', class: `onb-choice ${cls}` + (selected ? ' is-selected' : ''), 'aria-pressed': String(selected), onClick }, [
      ...children,
      h('span', { class: 'onb-radio', 'aria-hidden': 'true' }, selected ? icon('check', 14) : null),
    ]);
  }

  function openLegal(key) {
    const doc = legalPage(key);
    const article = h('article', { class: 'legal' }, [doc.intro ? h('p', { class: 'legal-intro' }, doc.intro) : null]);
    for (const sec of doc.sections) {
      article.appendChild(h('h2', { class: 'legal-h' }, sec.heading));
      for (const part of sec.body) article.appendChild(Array.isArray(part) ? h('ul', {}, part.map((li) => h('li', {}, li))) : h('p', {}, part));
    }
    openSheet(article, { title: doc.title, tall: true });
  }
  const legalLink = (label, key) => h('button', { type: 'button', class: 'text-link', onClick: () => openLegal(key) }, label);

  // ---- steps ----
  const STEPS = {
    welcome() {
      const logo = h('div', { class: 'onb-logo', 'aria-hidden': 'true' });
      logo.innerHTML = LOGO;
      return {
        body: [
          logo,
          ...title(t('Welcome to Oracle'), t('Log what you spend in seconds and see where your money goes.')),
          h('ul', { class: 'welcome-points' }, [
            point('plus', 'var(--c-mint)', t('Quick to log'), t('Track any expense in a few taps.')),
            point('shield', 'var(--c-blue)', t('Secure data'), t('Private and stored only on your device. Not even we can see it.')),
            point('sync', 'var(--c-amber)', t('Works offline'), t('Move data between your phone and laptop with a sync file.')),
          ]),
          h('p', { class: 'onb-label' }, t('Language')),
          h(
            'div',
            { class: 'onb-choices onb-choices-row' },
            LANGUAGES.map((l) =>
              choice({
                selected: lang() === l.code,
                onClick: async () => {
                  await updateSettings({ language: l.code }, { touch: false });
                  render();
                },
                children: [h('span', { class: 'onb-choice-text' }, [h('strong', {}, l.native)])],
              })
            )
          ),
        ],
        foot: [
          primary(t('Get started'), nextStep),
          h('p', { class: 'welcome-legal' }, [
            t('By continuing you agree to the'),
            ' ',
            legalLink(t('Terms of use'), 'terms'),
            ' ',
            t('and'),
            ' ',
            legalLink(t('Privacy policy'), 'privacy'),
            '.',
          ]),
        ],
      };
    },

    name() {
      const input = h('input', {
        type: 'text',
        class: 'input onb-input',
        maxlength: 40,
        value: state.name,
        placeholder: t('Your first name'),
        'aria-label': t('Your name'),
        autocomplete: 'given-name',
        onInput: (e) => (state.name = e.target.value),
        onKeydown: (e) => e.key === 'Enter' && nextStep(),
      });
      setTimeout(() => input.focus({ preventScroll: true }), 300);
      return {
        body: [...title(t('What should we call you?'), t('Just for greetings on the home screen. It stays on this device.')), input],
        foot: [primary(t('Continue'), nextStep)],
      };
    },

    theme() {
      const current = getSettings().theme || 'auto';
      const opts = [
        { value: 'light', label: t('Light'), sub: t('Bright and clear in daylight') },
        { value: 'dark', label: t('Dark'), sub: t('Easy on the eyes at night') },
        { value: 'auto', label: t('System'), sub: t('Follows your device setting') },
      ];
      return {
        body: [
          ...title(t('Pick your look'), t('You can change it any time in You → Appearance.')),
          h(
            'div',
            { class: 'onb-choices' },
            opts.map((o) =>
              choice({
                selected: current === o.value,
                cls: 'onb-theme',
                onClick: async () => {
                  await updateSettings({ theme: o.value }, { touch: false });
                  render();
                },
                children: [
                  h('span', { class: `onb-preview onb-preview-${o.value}`, 'aria-hidden': 'true' }, [h('i'), h('i'), h('i')]),
                  h('span', { class: 'onb-choice-text' }, [h('strong', {}, o.label), h('span', {}, o.sub)]),
                ],
              })
            )
          ),
        ],
        foot: [primary(t('Continue'), nextStep)],
      };
    },

    notify() {
      const unsupported = notificationSupport() === 'unsupported';
      const preview = h('div', { class: 'onb-notif', 'aria-hidden': 'true' }, [
        h('span', { class: 'onb-notif-icon' }, icon('bell', 16)),
        h('span', { class: 'onb-notif-text' }, [
          h('strong', {}, t('Had lunch yet?')),
          h('span', {}, t('You usually have {meal} around {time}. Spent anything? Log it in a few seconds.', { meal: t('Lunch').toLowerCase(), time: '12:30' })),
        ]),
      ]);
      return {
        body: [
          ...title(t('Never forget to log a meal'), t('Oracle can remind you after breakfast, lunch or dinner, but only if you haven’t logged it yet.')),
          preview,
          h('ul', { class: 'welcome-points' }, [
            point('clock', 'var(--c-blue)', t('At your meal times'), t('You choose when you usually eat. Skip any meal you don’t have.')),
            point('shield', 'var(--c-mint)', t('Private on the lock screen'), t('Reminders never show amounts unless you allow it.')),
            point('settings', 'var(--c-lilac)', t('Your choice'), t('Change or turn them off any time in You → Notifications.')),
          ]),
        ],
        foot: [
          primary(unsupported ? t('Continue') : n.enabled ? t('Set meal times') : t('Turn on reminders'), async (e) => {
            if (unsupported) return go('done');
            e.currentTarget.disabled = true;
            const result = await requestPermission();
            if (result === 'granted') {
              state.remindersOn = true;
              await updateNotificationSettings({ enabled: true });
              go('meals');
            } else {
              toast(result === 'denied' ? t('Notifications are blocked. You can allow them later in settings.') : t('Notifications aren’t available here.'));
              go('done');
            }
          }),
          unsupported ? h('p', { class: 'hint center' }, t('This browser can’t show notifications.')) : secondary(t('Not now'), () => go('done')),
        ],
      };
    },

    meals() {
      const cards = REMINDER_MEALS.map((m) => {
        const on = state.meals[m.key];
        const label = t(m.label);
        const select = h(
          'select',
          {
            class: 'input meal-select',
            disabled: !on,
            'aria-label': t('{meal} time', { meal: label }),
            onChange: (e) => (state.mealTimes[m.key] = e.target.value),
          },
          mealTimeOptions(m.key).map((v) => h('option', { value: v, selected: v === state.mealTimes[m.key] }, v))
        );
        const skip = h('label', { class: 'onb-skip' }, [
          h('input', {
            type: 'checkbox',
            checked: !on,
            onChange: (e) => {
              state.meals[m.key] = !e.target.checked;
              render();
            },
          }),
          h('span', {}, t('I usually skip {meal}', { meal: label.toLowerCase() })),
        ]);
        return h('div', { class: 'onb-meal' + (on ? '' : ' is-off') }, [
          h('div', { class: 'onb-meal-head' }, [
            h('span', { class: 'set-icon', style: `--set-icon:${MEAL_LOOK[m.key].color}` }, icon(MEAL_LOOK[m.key].icon, 18)),
            h('strong', {}, label),
            select,
          ]),
          skip,
        ]);
      });
      return {
        body: [
          ...title(t('When do you usually eat?'), t('Pick the closest half hour. Not sure? Keep the default; you can change it later.')),
          h('div', { class: 'onb-note' }, [
            icon('info', 18),
            h('p', {}, t('These times are only used to remind you to log your expenses. Oracle doesn’t track your meals or your health.')),
          ]),
          h('div', { class: 'onb-meals' }, cards),
        ],
        foot: [
          primary(t('Save meal times'), async () => {
            await updateNotificationSettings({ meals: { ...state.meals }, mealTimes: { ...state.mealTimes } });
            nextStep();
          }),
        ],
      };
    },

    done() {
      const s = getSettings();
      const n = notificationSettings();
      const themeLabel = { light: t('Light'), dark: t('Dark'), auto: t('System') }[s.theme || 'auto'];
      const reminders = n.enabled
        ? REMINDER_MEALS.filter((m) => n.meals[m.key])
            .map((m) => `${t(m.label)} ${n.mealTimes[m.key] || minutesToHHMM(m.fallback)}`)
            .join('\n') || t('On')
        : t('Off');
      const line = (label, value) => h('div', { class: 'onb-summary-row' }, [h('span', {}, label), h('strong', {}, value)]);
      const name = state.name.trim();
      return {
        body: [
          h('div', { class: 'onb-done-mark', 'aria-hidden': 'true' }, icon('check', 34)),
          ...title(name ? t('You’re all set, {name}!', { name }) : t('You’re all set!'), t('Tap + to log your first expense. Everything here can be changed in the You tab.')),
          h('p', { class: 'hint center' }, t('Want to see the tour again? Open You → Help guide.')),
          h('div', { class: 'onb-summary' }, [
            line(t('Language'), LANGUAGES.find((l) => l.code === lang())?.native || ''),
            line(t('Theme'), themeLabel),
            line(t('Meal reminders'), reminders),
          ]),
        ],
        foot: [primary(t('Start using Oracle'), finish)],
      };
    },
  };

  function point(iconName, color, strong, text) {
    return h('li', { class: 'welcome-point' }, [
      h('span', { class: 'set-icon', style: `--set-icon:${color}` }, icon(iconName, 18)),
      h('span', {}, [h('strong', {}, strong), h('span', {}, text)]),
    ]);
  }

  function render() {
    const view = STEPS[step]();
    // top bar: back · progress · skip
    clear(top);
    const qIndex = QUESTIONS.filter((q) => steps().includes(q)).indexOf(step);
    const qCount = QUESTIONS.filter((q) => steps().includes(q)).length;
    top.append(
      step !== 'welcome' && step !== 'done'
        ? h('button', { type: 'button', class: 'orb-btn', 'aria-label': t('Back'), onClick: prevStep }, icon('chevronLeft', 20))
        : h('span', { class: 'onb-top-spacer' }),
      qIndex >= 0
        ? h(
            'div',
            { class: 'onb-progress', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(qCount), 'aria-valuenow': String(qIndex + 1), 'aria-label': t('Step {n} of {total}', { n: qIndex + 1, total: qCount }) },
            Array.from({ length: qCount }, (_, i) => h('span', { class: i <= qIndex ? 'is-done' : '' }))
          )
        : h('span'),
      qIndex >= 0
        ? h('button', { type: 'button', class: 'onb-skip-all', onClick: () => (state.tourDone ? go('done') : runTour('done')) }, t('Skip'))
        : h('span', { class: 'onb-top-spacer' })
    );
    // slide only when moving between steps, not when a choice redraws the same one
    const sameStep = overlay.dataset.step === step;
    const scroll = body.scrollTop;
    clear(body);
    const page = h('div', { class: 'onb-page' + (sameStep ? ' is-still' : direction < 0 ? ' is-back' : '') }, view.body);
    body.appendChild(page);
    body.scrollTop = sameStep ? scroll : 0;
    clear(foot);
    foot.append(...view.foot);
    overlay.dataset.step = step;
  }

  render();
  document.body.classList.add('has-onb');
  document.body.appendChild(overlay);
}
