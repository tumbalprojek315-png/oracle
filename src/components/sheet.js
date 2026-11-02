import { h } from '../dom.js';
import { icon } from '../icons.js';

let activeClose = null;

export function closeSheet() {
  if (activeClose) activeClose();
}

export function isSheetOpen() {
  return !!activeClose;
}

// Bottom sheet on phones, centered panel on wide screens.
export function openSheet(contentEl, { title, subtitle, onClose, tall = false } = {}) {
  closeSheet();
  const root = document.getElementById('sheet-root');

  const backdrop = h('div', { class: 'sheet-backdrop' });
  const panel = h('div', {
    class: 'sheet-panel' + (tall ? ' sheet-tall' : ''),
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title || '',
  });

  panel.appendChild(h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }));
  if (title) {
    panel.appendChild(
      h('div', { class: 'sheet-header' }, [
        h('div', {}, [h('h2', { class: 'sheet-title' }, title), subtitle ? h('p', { class: 'sheet-subtitle' }, subtitle) : null]),
        h('button', { type: 'button', class: 'orb-btn', 'aria-label': 'Close', onClick: () => close() }, icon('close', 18)),
      ])
    );
  }
  panel.appendChild(h('div', { class: 'sheet-body' }, [contentEl]));

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.classList.remove('is-open');
    panel.classList.remove('is-open');
    if (activeClose === close) activeClose = null;
    document.body.classList.remove('has-sheet');
    setTimeout(() => {
      backdrop.remove();
      panel.remove();
    }, 220);
    if (onClose) onClose();
  }

  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  root.appendChild(backdrop);
  root.appendChild(panel);
  activeClose = close;
  document.body.classList.add('has-sheet');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    panel.classList.add('is-open');
  });

  return { close, panel };
}

// Toast with an optional action button (used for Undo).
export function toast(message, { action, duration = 3200 } = {}) {
  const root = document.getElementById('toast-root');
  root.textContent = '';
  const el = h('div', { class: 'toast' }, [
    h('span', { class: 'toast-msg' }, message),
    action
      ? h(
          'button',
          {
            type: 'button',
            class: 'toast-action',
            onClick: () => {
              action.onClick();
              hide();
            },
          },
          action.label
        )
      : null,
  ]);
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  const timer = setTimeout(hide, action ? Math.max(duration, 5000) : duration);
  function hide() {
    clearTimeout(timer);
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 250);
  }
}

// Styled replacement for window.confirm(). With `acknowledge` (a sentence),
// the confirm button stays locked until that checkbox is ticked. With
// `option` ({ label, checked }), an optional checkbox is shown and the promise
// resolves to { confirmed, option } instead of a boolean.
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, acknowledge = null, option = null, hideCancel = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('sheet-root');
    const backdrop = h('div', { class: 'sheet-backdrop is-open dialog-backdrop' });
    const confirmBtn = h(
      'button',
      { type: 'button', class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), disabled: !!acknowledge, onClick: () => finish(true) },
      confirmLabel
    );
    const ackBox = acknowledge
      ? h('label', { class: 'ack' }, [
          h('input', { type: 'checkbox', onChange: (e) => (confirmBtn.disabled = !e.target.checked) }),
          h('span', { class: 'ack-box', 'aria-hidden': 'true' }, icon('check', 14)),
          h('span', {}, acknowledge),
        ])
      : null;
    const optInput = option ? h('input', { type: 'checkbox', checked: !!option.checked }) : null;
    const optBox = option
      ? h('label', { class: 'ack ack-option' }, [optInput, h('span', { class: 'ack-box', 'aria-hidden': 'true' }, icon('check', 14)), h('span', {}, option.label)])
      : null;
    const box = h('div', { class: 'dialog' + (danger ? ' dialog-danger' : ''), role: 'alertdialog', 'aria-modal': 'true', 'aria-label': title }, [
      danger ? h('span', { class: 'dialog-icon', 'aria-hidden': 'true' }, icon('trash', 22)) : null,
      h('h3', { class: 'dialog-title' }, title),
      message ? h('p', { class: 'dialog-msg' }, message) : null,
      ackBox,
      optBox,
      h('div', { class: 'dialog-actions' }, [hideCancel ? null : h('button', { type: 'button', class: 'btn btn-ghost', onClick: () => finish(false) }, 'Cancel'), confirmBtn]),
    ]);
    function onKey(e) {
      if (e.key === 'Escape') finish(false);
    }
    function finish(v) {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      box.remove();
      resolve(option ? { confirmed: v, option: !!optInput.checked } : v);
    }
    document.addEventListener('keydown', onKey, true);
    backdrop.addEventListener('click', () => finish(false));
    root.appendChild(backdrop);
    root.appendChild(box);
    (acknowledge ? box.querySelector('.ack input') : confirmBtn).focus();
  });
}
