import { h, clear } from '../dom.js';
import { toast } from './sheet.js';
import { icon } from '../icons.js';
import { t } from '../i18n.js';

// A list of pill tags with a pencil on each (on hover with a mouse, always on
// touch screens). Pencil -> inline editor: rename (Save), Delete, Cancel.
// Plus an "add new" row. `remove(name)` asks for confirmation, deletes, and
// returns { message, undo } (or null if cancelled).
export function editableList({ noun, placeholder, items, add, rename, remove }) {
  let editing = null;
  const list = h('div', { class: 'tag-list' });
  const error = h('p', { class: 'form-error form-error-left', hidden: true });
  const addInput = h('input', {
    type: 'text',
    class: 'input',
    placeholder,
    'aria-label': placeholder,
    onKeydown: (e) => e.key === 'Enter' && (e.preventDefault(), doAdd()),
  });

  function showError(msg) {
    error.textContent = msg || '';
    error.hidden = !msg;
  }

  async function doAdd() {
    const err = await add(addInput.value);
    showError(err);
    if (!err) addInput.value = '';
  }

  function editor(name) {
    const input = h('input', {
      type: 'text',
      class: 'input',
      value: name,
      'aria-label': t('New name for {name}', { name }),
      onKeydown: (e) => {
        if (e.key === 'Enter') (e.preventDefault(), save());
        if (e.key === 'Escape') (e.stopPropagation(), close());
      },
    });
    async function save() {
      const err = await rename(name, input.value);
      if (err) return showError(err);
      const renamed = input.value.trim();
      close();
      if (renamed !== name) toast(t('Renamed to {name}', { name: renamed }));
    }
    function close() {
      editing = null;
      showError(null);
      render();
    }
    async function doRemove() {
      const done = await remove(name);
      if (!done) return;
      close();
      toast(done.message, { action: { label: 'Undo', onClick: done.undo }, duration: 8000 });
    }
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    return h('div', { class: 'cat-editor' }, [
      input,
      h('div', { class: 'cat-editor-actions' }, [
        h('button', { type: 'button', class: 'btn btn-danger-ghost btn-sm', onClick: doRemove }, [icon('trash', 16), h('span', {}, t('Delete'))]),
        h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onClick: close }, t('Cancel')),
        h('button', { type: 'button', class: 'btn btn-primary btn-sm', onClick: save }, t('Save')),
      ]),
    ]);
  }

  function render() {
    clear(list);
    const names = items();
    if (!names.length) list.appendChild(h('p', { class: 'hint' }, t('Nothing here yet. Add one below.')));
    for (const name of names) {
      if (name === editing) {
        list.appendChild(editor(name));
        continue;
      }
      list.appendChild(
        h('span', { class: 'tag tag-editable' }, [
          h('span', {}, name),
          h(
            'button',
            {
              type: 'button',
              class: 'tag-edit',
              'aria-label': t('Edit or delete {name}', { name }),
              title: t('Edit or delete'),
              onClick: () => {
                editing = name;
                showError(null);
                render();
              },
            },
            icon('edit', 12)
          ),
        ])
      );
    }
  }

  render();
  return {
    root: h('div', { class: 'editable-list' }, [
      list,
      h('div', { class: 'inline-form' }, [addInput, h('button', { type: 'button', class: 'btn btn-primary btn-sm', onClick: doAdd }, t('Add'))]),
      error,
    ]),
    render,
    reset() {
      editing = null;
      showError(null);
      render();
    },
  };
}
