// Types, categories and payment methods. The category lists live in settings
import { t as tr } from './i18n.js';
// (store.js, editable from Settings); every screen asks this module instead
// of hard-coding lists.
import { getSettings, DEFAULT_CATEGORIES, DEFAULT_PAYMENT_METHODS } from './store.js';

export const TYPES = [
  { key: 'food', label: 'Food', icon: 'food' },
  { key: 'non_food', label: 'Non-food', icon: 'bag' },
  { key: 'fixed', label: 'Fixed', icon: 'repeat' },
];

export const CAT_EATING_OUT = 'Eating Out';
export const CAT_GROCERIES = 'Groceries';
export const CAT_TRANSPORTATION = 'Transportation';

const CATEGORY_ICONS = {
  'Eating Out': 'food',
  Groceries: 'cart',
  'Drinks & Snacks': 'cup',
  Transportation: 'bus',
  'Dorm Essentials': 'box',
  Shopping: 'bag',
  Health: 'heart',
  Entertainment: 'spark',
  Education: 'book',
  'Rent/Accommodation': 'home',
  Utilities: 'bolt',
  'Phone/Data': 'phone',
  Subscription: 'repeat',
  Insurance: 'shield',
};

// Types counted in totals, the budget and Insights (Settings > Insights toggle).
export function countedTypes() {
  const t = getSettings().countedTypes;
  return Array.isArray(t) && t.length ? t : TYPES.map((x) => x.key);
}

export function countedLabel() {
  const t = countedTypes();
  return t.length === TYPES.length ? tr('All types') : TYPES.filter((x) => t.includes(x.key)).map((x) => tr(x.label)).join(' + ');
}

export function typeLabel(key) {
  const t = TYPES.find((t) => t.key === key);
  return t ? t.label : key;
}

export function categoriesForType(typeKey) {
  return [...((getSettings().categories || DEFAULT_CATEGORIES)[typeKey] || [])];
}

// Which type a category name belongs to (for imported rows with no type).
export function typeOfCategory(name) {
  const lists = getSettings().categories || DEFAULT_CATEGORIES;
  return Object.keys(lists).find((t) => lists[t].includes(name)) || Object.keys(DEFAULT_CATEGORIES).find((t) => DEFAULT_CATEGORIES[t].includes(name)) || '';
}

export function paymentMethods() {
  return [...(getSettings().paymentMethods || DEFAULT_PAYMENT_METHODS)];
}

export function categoryIcon(category, type) {
  if (CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
  const t = TYPES.find((t) => t.key === type);
  return t ? t.icon : 'tag';
}

// Stable color per type, used for the icon orbs and charts.
export const TYPE_COLOR = {
  food: 'var(--c-mint)',
  non_food: 'var(--c-blue)',
  fixed: 'var(--c-amber)',
};
