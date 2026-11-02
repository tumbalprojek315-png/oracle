import { h, clear } from '../dom.js';
import { icon } from '../icons.js';

// Single-select pill group. Options: string | { value, label, icon? }.
// `allowNone` lets a second tap on the selected chip clear it.
export function chipGroup({ options, value, onChange, ariaLabel, variant = 'chips', allowNone = false }) {
  const wrap = h('div', { class: variant === 'seg' ? 'seg' : 'chip-group', role: 'group', 'aria-label': ariaLabel || '' });
  wrap._value = value;

  function render() {
    clear(wrap);
    for (const opt of options) {
      const val = typeof opt === 'string' ? opt : opt.value;
      const label = typeof opt === 'string' ? opt : opt.label;
      const selected = val === wrap._value;
      wrap.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: (variant === 'seg' ? 'seg-btn' : 'chip') + (selected ? ' is-selected' : ''),
            'aria-pressed': selected ? 'true' : 'false',
            onClick: () => {
              const next = selected && allowNone ? '' : val;
              if (next === wrap._value) return;
              wrap._value = next;
              render();
              onChange(next);
            },
          },
          [opt.icon ? icon(opt.icon, 16) : null, h('span', {}, label)]
        )
      );
    }
  }

  wrap.setOptions = (opts, newValue) => {
    options = opts;
    wrap._value = newValue;
    render();
  };
  wrap.setValue = (v) => {
    wrap._value = v;
    render();
  };
  wrap.getValue = () => wrap._value;

  render();
  return wrap;
}
