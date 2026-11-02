import { h } from '../dom.js';
import { TYPES, categoriesForType, paymentMethods, categoryIcon, CAT_TRANSPORTATION } from '../categories.js';
import { chipGroup } from './chips.js';
import { textChipField } from './textChipField.js';
import { amountKeypad } from './amountKeypad.js';
import { datePicker } from './datePicker.js';
import { todayISO } from '../format.js';
import { nowHHMM, mealBucket, mealBucketLabel } from '../mealTime.js';
import { getEntries, getSettings, lastPaymentMethodFor, excludeLocationSuggestion, excludeItemNameSuggestion } from '../store.js';
import { icon } from '../icons.js';

function field(labelText, control, { hint, iconName } = {}) {
  return h('div', { class: 'field' }, [
    h('div', { class: 'field-label' }, [iconName ? icon(iconName, 14) : null, h('span', {}, labelText), hint ? h('span', { class: 'field-hint' }, hint) : null]),
    control,
  ]);
}

// The add/edit form. mode 'create' | 'edit'. `onSave(record, { again })`.
export function entryForm({ mode = 'create', initial = null, defaults = null, onSave, onDelete }) {
  const baseType = initial?.type ?? defaults?.type ?? 'food';
  const state = {
    id: initial?.id ?? null,
    amount: initial ? String(initial.amount) : '',
    type: baseType,
    category: initial?.category ?? defaults?.category ?? categoriesForType(baseType)[0],
    location: initial?.location ?? '',
    itemName: initial?.itemName ?? '',
    mealTime: initial?.mealTime ?? (baseType === 'food' ? nowHHMM() : ''),
    transportFrom: initial?.transportFrom ?? '',
    transportTo: initial?.transportTo ?? '',
    paymentMethod: initial?.paymentMethod ?? '',
    date: initial?.date ?? defaults?.date ?? todayISO(),
    notes: initial?.notes ?? '',
  };
  let paymentTouched = !!initial;

  const form = h('form', { class: 'entry-form', novalidate: true });

  const dateEl = datePicker({ value: state.date, ariaLabel: 'Date', onChange: (iso) => (state.date = iso) });

  const typeSeg = chipGroup({
    variant: 'seg',
    options: TYPES.map((t) => ({ value: t.key, label: t.label, icon: t.icon })),
    value: state.type,
    ariaLabel: 'Type',
    onChange: (val) => {
      state.type = val;
      const cats = categoriesForType(val);
      state.category = cats[0];
      categoryChips.setOptions(catOptions(), state.category);
      if (val === 'food' && !state.mealTime) {
        state.mealTime = nowHHMM();
        mealTimeInput.value = state.mealTime;
        updateMealBadge();
      }
      applyVisibility();
      refreshSuggestions();
      suggestPayment();
      clearError();
    },
  });

  const amountEl = amountKeypad({
    value: state.amount,
    onChange: (v) => {
      state.amount = v;
      clearError();
      syncSaveState();
    },
    onEnter: () => form.requestSubmit(saveBtn),
  });

  function catOptions() {
    return categoriesForType(state.type).map((c) => ({ value: c, label: c, icon: categoryIcon(c, state.type) }));
  }
  const categoryChips = chipGroup({
    options: catOptions(),
    value: state.category,
    ariaLabel: 'Category',
    onChange: (val) => {
      state.category = val;
      applyVisibility();
      refreshSuggestions();
      suggestPayment();
    },
  });
  categoryChips.classList.add('chip-wrap');

  // ---- smart payment default: same place → same category → last used ----
  function suggestPayment() {
    if (paymentTouched) return;
    const list = getEntries();
    const loc = state.location.trim().toLowerCase();
    const s =
      (loc && lastPaymentMethodFor(list, (e) => (e.location || '').toLowerCase() === loc)) ||
      lastPaymentMethodFor(list, (e) => e.category === state.category) ||
      lastPaymentMethodFor(list, () => true) ||
      '';
    state.paymentMethod = s;
    paymentChips.setValue(s);
  }

  const excludedLoc = () => new Set(getSettings().excludedLocations || []);
  const excludedItem = () => new Set(getSettings().excludedItemNames || []);
  const locationScope = () => getEntries().filter((e) => e.type === 'food' && e.category === state.category && !excludedLoc().has(e.location));
  const itemScope = () => getEntries().filter((e) => e.type === state.type && !excludedItem().has((e.itemName || '').trim()));

  const locationEl = textChipField({
    entries: locationScope(),
    value: state.location,
    keyFn: (e) => e.location,
    iconName: 'pin',
    placeholder: 'Where?',
    onChange: (v) => (state.location = v),
    onPick: () => suggestPayment(),
    onCommit: () => suggestPayment(),
    onRemove: async (name) => {
      await excludeLocationSuggestion(name);
      refreshSuggestions();
    },
  });

  const itemNameEl = textChipField({
    entries: itemScope(),
    value: state.itemName,
    keyFn: (e) => (e.itemName || '').trim(),
    iconName: 'tag',
    placeholder: 'What?',
    onChange: (v) => (state.itemName = v),
    onRemove: async (name) => {
      await excludeItemNameSuggestion(name);
      refreshSuggestions();
    },
  });

  function refreshSuggestions() {
    locationEl.refresh(locationScope());
    itemNameEl.refresh(itemScope());
  }

  const mealBadge = h('span', { class: 'meal-badge' });
  function updateMealBadge() {
    const b = mealBucket(state.mealTime);
    mealBadge.textContent = b ? mealBucketLabel(b) : '';
    mealBadge.hidden = !b;
  }
  const mealTimeInput = h('input', {
    type: 'time',
    class: 'input input-time',
    value: state.mealTime,
    'aria-label': 'Meal time',
    onInput: (e) => {
      state.mealTime = e.target.value;
      updateMealBadge();
    },
  });

  const fromInput = h('input', { type: 'text', class: 'input', placeholder: 'From', value: state.transportFrom, 'aria-label': 'From', onInput: (e) => (state.transportFrom = e.target.value) });
  const toInput = h('input', { type: 'text', class: 'input', placeholder: 'To', value: state.transportTo, 'aria-label': 'To', onInput: (e) => (state.transportTo = e.target.value) });

  const paymentChips = chipGroup({
    options: paymentMethods(),
    value: state.paymentMethod,
    ariaLabel: 'Payment method',
    allowNone: true,
    onChange: (val) => {
      state.paymentMethod = val;
      paymentTouched = true;
    },
  });
  paymentChips.classList.add('chip-wrap');

  const notesInput = h('textarea', { class: 'input notes', rows: 2, placeholder: 'Anything to remember?', onInput: (e) => (state.notes = e.target.value) }, state.notes);

  const errorText = h('p', { class: 'form-error', role: 'alert', hidden: true });
  function clearError() {
    errorText.hidden = true;
  }

  const saveBtn = h('button', { type: 'submit', class: 'btn btn-primary btn-save', dataset: { again: '0' } }, [icon('check', 18), h('span', {}, mode === 'edit' ? 'Save changes' : 'Save')]);
  const againBtn =
    mode === 'create'
      ? h('button', { type: 'submit', class: 'btn btn-ghost', dataset: { again: '1' }, title: 'Save and keep this open for the next one' }, [icon('plus', 18), h('span', {}, 'Save + next')])
      : null;

  function isValid() {
    const amt = parseFloat(state.amount);
    return Number.isFinite(amt) && amt > 0 && !!state.category;
  }
  function syncSaveState() {
    saveBtn.classList.toggle('is-dim', !isValid());
    if (againBtn) againBtn.classList.toggle('is-dim', !isValid());
  }

  const locationField = field('Place', locationEl, { iconName: 'pin' });
  const itemField = field('Item', itemNameEl, { iconName: 'tag', hint: 'Optional' });
  const mealField = field('Meal time', h('div', { class: 'meal-row' }, [mealTimeInput, mealBadge]), { iconName: 'clock' });
  const routeField = field('Route', h('div', { class: 'route-row' }, [fromInput, icon('arrowRight', 18), toInput]), { iconName: 'bus', hint: 'Optional' });
  const paymentField = field('Paid with', paymentChips, { iconName: 'card' });
  const notesField = field('Notes', notesInput, { iconName: 'note', hint: 'Optional' });

  function applyVisibility() {
    const isFood = state.type === 'food';
    locationField.hidden = !isFood;
    mealField.hidden = !isFood;
    const isTransportCat = state.type === 'non_food' && state.category === CAT_TRANSPORTATION;
    itemField.hidden = state.type === 'fixed' || isTransportCat; // transport uses Route instead
    routeField.hidden = !(state.type === 'non_food' && state.category === CAT_TRANSPORTATION);
  }

  function resetForNext() {
    Object.assign(state, { amount: '', location: '', itemName: '', notes: '', transportFrom: '', transportTo: '' });
    state.mealTime = state.type === 'food' ? nowHHMM() : '';
    paymentTouched = false;
    amountEl.setValue('');
    locationEl.setValue('');
    itemNameEl.setValue('');
    notesInput.value = '';
    fromInput.value = '';
    toInput.value = '';
    mealTimeInput.value = state.mealTime;
    updateMealBadge();
    refreshSuggestions();
    suggestPayment();
    syncSaveState();
    form.closest('.sheet-body')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const again = e.submitter?.dataset.again === '1';
    if (!isValid()) {
      errorText.hidden = false;
      errorText.textContent = !(parseFloat(state.amount) > 0) ? 'Enter an amount first.' : 'Pick a category.';
      amountEl.querySelector('.amount-readout').classList.add('shake');
      setTimeout(() => amountEl.querySelector('.amount-readout').classList.remove('shake'), 400);
      return;
    }
    const isFood = state.type === 'food';
    const isTransport = state.type === 'non_food' && state.category === CAT_TRANSPORTATION;
    const record = {
      amount: parseFloat(state.amount),
      type: state.type,
      category: state.category,
      location: isFood ? state.location.trim() : '',
      itemName: state.type !== 'fixed' && !isTransport ? state.itemName.trim() : '',
      mealTime: isFood ? state.mealTime : '',
      transportFrom: isTransport ? state.transportFrom.trim() : '',
      transportTo: isTransport ? state.transportTo.trim() : '',
      paymentMethod: state.paymentMethod,
      date: state.date,
      notes: state.notes.trim(),
    };
    if (state.id) record.id = state.id;
    saveBtn.disabled = true;
    if (againBtn) againBtn.disabled = true;
    try {
      await onSave(record, { again });
      if (again) resetForNext();
    } catch (err) {
      errorText.hidden = false;
      errorText.textContent = 'Could not save: ' + (err?.message || 'unexpected error');
    } finally {
      saveBtn.disabled = false;
      if (againBtn) againBtn.disabled = false;
    }
  });

  const parts = [
    h('div', { class: 'form-top' }, [dateEl]),
    typeSeg,
    amountEl,
    field('Category', categoryChips),
    locationField,
    itemField,
    mealField,
    routeField,
    paymentField,
    notesField,
    errorText,
    mode === 'edit' && state.id
      ? h('button', { type: 'button', class: 'btn btn-danger-ghost', onClick: () => onDelete && onDelete(state.id) }, [icon('trash', 18), h('span', {}, 'Delete this entry')])
      : null,
    h('div', { class: 'save-bar' }, [againBtn, saveBtn]),
  ];
  form.append(...parts.filter(Boolean));

  applyVisibility();
  updateMealBadge();
  if (mode === 'create') suggestPayment();
  syncSaveState();

  form.destroy = () => amountEl.destroy();
  return form;
}
