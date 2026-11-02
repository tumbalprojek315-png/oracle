import { h, clear } from '../dom.js';
import { t, tn, locale } from '../i18n.js';
import { topByRecencyFrequency, allDistinctValues } from '../store.js';
import { icon } from '../icons.js';

let uid = 0;

// Text input + quick-tap suggestion chips (frequency × recency) + datalist
// autocomplete. Each chip has a small × that hides it from suggestions
// (past entries are untouched). The × stays hidden until you hover the chip
// (mouse) or long-press it (touch), so it isn't tapped by accident.
export function textChipField({ entries, keyFn, value, placeholder, iconName, onChange, onPick, onCommit, onRemove }) {
  uid += 1;
  const listId = `tcf-list-${uid}`;
  const chipsRow = h('div', { class: 'suggest-row' });
  const datalist = h('datalist', { id: listId });
  const input = h('input', {
    type: 'text',
    class: 'input',
    placeholder: placeholder || 'Type…',
    value: value || '',
    list: listId,
    autocomplete: 'off',
    enterkeyhint: 'done',
    onInput: (e) => {
      onChange(e.target.value);
      markSelected();
    },
    onChange: (e) => {
      if (onCommit && e.target.value.trim()) onCommit(e.target.value.trim());
    },
  });

  function markSelected() {
    const v = input.value.trim().toLowerCase();
    for (const b of chipsRow.querySelectorAll('.suggest-pick')) {
      b.parentElement.classList.toggle('is-selected', b.textContent.toLowerCase() === v);
    }
  }

  function renderChips() {
    clear(chipsRow);
    const top = topByRecencyFrequency(entries, keyFn, 6);
    chipsRow.hidden = !top.length;
    for (const name of top) {
      let pressTimer = null;
      let longPressed = false;
      const chip = h('span', { class: 'suggest' });
      chip.append(
        ...[
          h(
            'button',
            {
              type: 'button',
              class: 'suggest-pick',
              onPointerdown: (e) => {
                if (e.pointerType !== 'touch' || !onRemove) return;
                longPressed = false;
                pressTimer = setTimeout(() => {
                  longPressed = true;
                  for (const other of chipsRow.querySelectorAll('.suggest.show-x')) other.classList.remove('show-x');
                  chip.classList.add('show-x');
                  navigator.vibrate?.(15);
                }, 500);
              },
              onPointerup: () => clearTimeout(pressTimer),
              onPointerleave: () => clearTimeout(pressTimer),
              onPointercancel: () => clearTimeout(pressTimer),
              onContextmenu: (e) => onRemove && e.preventDefault(),
              onClick: () => {
                if (longPressed) {
                  longPressed = false;
                  return; // the long-press only revealed the ×
                }
                input.value = name;
                onChange(name);
                if (onPick) onPick(name);
                markSelected();
              },
            },
            name
          ),
          onRemove
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'suggest-x',
                  'aria-label': t('Hide {name} from suggestions', { name }),
                  title: 'Hide from suggestions',
                  onClick: (e) => {
                    e.stopPropagation();
                    onRemove(name);
                  },
                },
                icon('close', 12)
              )
            : null,
        ].filter(Boolean)
      );
      chipsRow.appendChild(chip);
    }
    markSelected();
  }

  function renderDatalist() {
    clear(datalist);
    for (const name of allDistinctValues(entries, keyFn)) datalist.appendChild(h('option', { value: name }));
  }

  renderChips();
  renderDatalist();
  // Tapping anywhere else hides a × that a long-press revealed.
  document.addEventListener('pointerdown', (e) => {
    if (!chipsRow.contains(e.target)) for (const c of chipsRow.querySelectorAll('.suggest.show-x')) c.classList.remove('show-x');
  });

  const wrap = h('div', { class: 'text-chip-field' }, [
    h('div', { class: 'input-wrap' }, [iconName ? icon(iconName, 18) : null, input]),
    chipsRow,
    datalist,
  ]);

  wrap.setValue = (v) => {
    input.value = v || '';
    markSelected();
  };
  wrap.refresh = (newEntries) => {
    entries = newEntries;
    renderChips();
    renderDatalist();
  };
  return wrap;
}
