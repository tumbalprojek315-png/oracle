// Oracle tracks Singapore dollars only, written as a plain "$".
import { t, tn, locale } from './i18n.js';
const CURRENCY = 'SGD';

const cache = new Map();
function formatter(kind) {
  const code = CURRENCY;
  const key = `${code}:${kind}`;
  if (!cache.has(key)) {
    const opts =
      kind === 'compact'
        ? { style: 'currency', currency: code, notation: 'compact', maximumFractionDigits: 1 }
        : { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 };
    cache.set(key, new Intl.NumberFormat('en-SG', opts));
  }
  return cache.get(key);
}

// en-SG writes SGD as a plain "$"; force it in case a runtime prefers "S$".
function fixSymbol(sym) {
  return sym.replace(/^S\$$|^SGD$/, '$');
}

function formatWith(kind, amount) {
  return formatter(kind)
    .formatToParts(amount || 0)
    .map((p) => (p.type === 'currency' ? fixSymbol(p.value) : p.value))
    .join('');
}

export function formatCurrency(amount) {
  return formatWith('full', amount);
}

export function formatCurrencyCompact(amount) {
  return formatWith('compact', amount);
}

// Splits "$1,234.50" into symbol / whole / cents so the hero numbers can
// style the cents smaller.
export function currencyParts(amount) {
  const parts = formatter('full').formatToParts(amount || 0);
  let symbol = '';
  let whole = '';
  let cents = '';
  let afterDecimal = false;
  for (const p of parts) {
    if (p.type === 'currency') symbol += fixSymbol(p.value);
    else if (p.type === 'decimal') afterDecimal = true;
    else if (p.type === 'fraction') cents += p.value;
    else if (p.type === 'minusSign') whole += p.value;
    else if (!afterDecimal && p.type !== 'literal') whole += p.value;
  }
  return { symbol, whole, cents };
}

export function currencySymbol() {
  return currencyParts(0).symbol;
}

export function toISO(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function formatDateLabel(iso) {
  if (iso === todayISO()) return t('Today');
  const yd = new Date();
  yd.setDate(yd.getDate() - 1);
  if (iso === toISO(yd)) return t('Yesterday');
  const d = new Date(iso + 'T00:00:00');
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' });
}

export function formatDateShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

// Lower-case so it reads inside a sentence ("exported 2 min ago"); use
// capitalize() when it stands alone as a value.
export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function relativeTime(isoTimestamp) {
  if (!isoTimestamp) return t('never');
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return t('just now');
  if (min < 60) return t('{n} min ago', { n: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t('{n} h ago', { n: hr });
  const days = Math.round(hr / 24);
  if (days === 1) return t('yesterday');
  return t('{n} days ago', { n: days });
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return t('Late night');
  if (h < 12) return t('Good morning');
  if (h < 17) return t('Good afternoon');
  return t('Good evening');
}
