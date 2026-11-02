import { h } from '../dom.js';
import { icon } from '../icons.js';
import { currencySymbol } from '../format.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];

// Big amount readout + on-screen keypad. Also listens to the physical
// keyboard (digits, ".", ",", Backspace) whenever no text field has focus,
// so typing on a laptop just works.
export function amountKeypad({ value = '', onChange, onEnter }) {
  let amount = value;
  const display = h('span', { class: 'amount-value' });
  const symbol = h('span', { class: 'amount-symbol' }, currencySymbol());
  const readout = h('div', { class: 'amount-readout', 'aria-live': 'polite', 'aria-label': 'Amount' }, [symbol, display]);
  const grid = h('div', { class: 'keypad' });

  function render() {
    display.textContent = amount || '0';
    readout.classList.toggle('is-empty', !amount);
    readout.classList.toggle('is-long', amount.length > 7);
  }

  function press(key) {
    if (key === 'back') {
      amount = amount.slice(0, -1);
    } else if (key === '.') {
      if (amount.includes('.')) return;
      amount = (amount || '0') + '.';
    } else {
      const dot = amount.indexOf('.');
      if (dot !== -1 && amount.length - dot > 2) return; // max 2 decimals
      if (dot === -1 && amount.replace(/^0+/, '').length >= 7) return; // up to 9,999,999
      amount = amount === '0' ? key : amount + key;
    }
    render();
    onChange(amount);
    readout.classList.remove('bump');
    void readout.offsetWidth;
    readout.classList.add('bump');
  }

  for (const key of KEYS) {
    grid.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'key' + (key === 'back' ? ' key-back' : ''),
          'aria-label': key === 'back' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key,
          onClick: () => press(key),
        },
        key === 'back' ? icon('backspace', 22) : key
      )
    );
  }

  function onKeydown(e) {
    if (!wrap.isConnected || wrap.closest('[hidden]')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if (e.key === '.' || e.key === ',') press('.');
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter' && onEnter) onEnter();
    else return;
    e.preventDefault();
  }
  document.addEventListener('keydown', onKeydown);

  const wrap = h('div', { class: 'amount-pad' }, [readout, grid]);
  render();

  wrap.setValue = (v) => {
    amount = v || '';
    render();
  };
  wrap.getValue = () => amount;
  wrap.refreshSymbol = () => (symbol.textContent = currencySymbol());
  wrap.destroy = () => document.removeEventListener('keydown', onKeydown);
  return wrap;
}
