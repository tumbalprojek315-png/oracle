// Translations. UI text is written in English in the code and wrapped in
// t('...'); the English text is the key, so English always works as the
// fallback and nothing breaks if a translation is missing.
//   t('Spent in {month}', { month }) → "Spent in October" / "Pengeluaran Oktober"
import { getSettings } from './store.js';
import { ID } from './i18n-id.js';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', short: 'English' },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', short: 'Indonesia' },
];

export function lang() {
  const l = getSettings().language;
  if (l === 'en' || l === 'id') return l;
  return (navigator.language || 'en').toLowerCase().startsWith('id') ? 'id' : 'en';
}

// Locale for dates and weekday/month names.
export function locale() {
  return lang() === 'id' ? 'id-ID' : 'en-US';
}

export function t(text, vars) {
  let out = lang() === 'id' ? ID[text] ?? text : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

// Singular/plural: tn(3, 'entry', 'entries') → "3 entries" / "3 entri".
export function tn(n, one, many) {
  return `${n} ${t(n === 1 ? one : many)}`;
}

// Static text in index.html: elements with data-i18n="English text".
export function translateStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  document.documentElement.lang = lang();
}

// Translate static text rendered by the views (headings, buttons, hints,
// placeholders, aria-labels) as it appears, so screens written with plain
// English strings switch language too. Dynamic text uses t() in the code.
// Anything inside data-no-i18n (user content: notes, items, places) is left
// untouched.
const ATTRS = ['placeholder', 'aria-label', 'title'];

function translateEl(el) {
  if (el.closest?.('[data-no-i18n]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    const tr = v && ID[v.trim()];
    // only write when it actually changes: writing triggers the observer again
    if (tr && tr !== v.trim()) el.setAttribute(a, tr);
  }
}

function translateText(node) {
  const raw = node.nodeValue;
  const key = raw && raw.trim();
  if (!key || !ID[key] || ID[key] === key || node.parentElement?.closest('[data-no-i18n], script, style, textarea')) return;
  node.nodeValue = raw.replace(key, ID[key]); // the result is never a key itself (checked below), so this can't loop
}

function translateTree(root) {
  if (root.nodeType === 3) return translateText(root);
  if (root.nodeType !== 1) return;
  translateEl(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === 3) translateText(n);
    else translateEl(n);
    n = walker.nextNode();
  }
}

export function startAutoTranslate(root = document.body) {
  const run = (records) => {
    if (lang() !== 'id') return;
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach(translateTree);
      else if (r.type === 'characterData') translateText(r.target);
      else if (r.type === 'attributes') translateEl(r.target);
    }
  };
  new MutationObserver(run).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  if (lang() === 'id') translateTree(root);
}

// Guard: a translation that is itself a different key would translate twice
// (and could loop). Warn during development.
for (const [k, v] of Object.entries(ID)) {
  if (v !== k && ID[v] && ID[v] !== v) console.warn('[i18n] translation is also a key:', k, '→', v);
}
