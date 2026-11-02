import { h, clear } from '../dom.js';
import { t, tn, locale } from '../i18n.js';
import { getEntries, getAllIncludingDeleted, getSettings, updateSettings, mergeEntries, mergeSettings, planMerge, applyMerge, subscribe } from '../store.js';
import { buildSyncFile, buildWorkbook, buildCsv, deliver, parseImportFile, canShareFiles } from '../transfer.js';
import { oldCloudSpaceToken, readOldCloudEntries, readOldLocalEntries, tokenFromLink } from '../legacy.js';
import { relativeTime, capitalize } from '../format.js';
import { toast, confirmDialog } from '../components/sheet.js';
import { icon } from '../icons.js';

const KIND_LABEL = { sync: 'Sync file', excel: 'Excel workbook', csv: 'CSV file' };

function plural(n, one, many = one + 's') {
  return tn(n, one, many);
}

// Shared by the Sync screen and window-wide drag & drop. Accepts a sync .json,
// an Excel .xlsx or a .csv exported from this app (also after editing it in a
// spreadsheet). Shows what will change before anything is written.
export async function importSyncFile(file) {
  let parsed;
  try {
    parsed = await parseImportFile(file);
  } catch (err) {
    await confirmDialog({ title: "Can't read this file", message: err.message, confirmLabel: 'OK', hideCancel: true });
    return null;
  }
  const plan = planMerge(parsed.entries, { timestamps: parsed.timestamps });
  const skippedLine = parsed.skipped?.length
    ? `
${plural(parsed.skipped.length, 'row')} can't be read and will be skipped (${parsed.skipped
        .slice(0, 3)
        .map((x) => t('row {n}: {why}', { n: x.row, why: t(x.reason) }))
        .join('; ')}${parsed.skipped.length > 3 ? '; …' : ''}).`
    : '';
  const from = parsed.device?.name ? ' ' + t('from {device}', { device: parsed.device.name }) : '';
  const when = parsed.exportedAt ? ', ' + t('exported {when}', { when: relativeTime(parsed.exportedAt) }) : '';
  const source = `${t(KIND_LABEL[parsed.kind])} “${file.name}”${from}${when}.`;

  const changes = plan.add.length + plan.update.length + plan.remove.length;
  if (!changes && !plan.deletedHere.length) {
    await confirmDialog({
      title: parsed.entries.length ? 'Already up to date' : 'Nothing to import',
      message: parsed.entries.length
        ? `${source}
${t('All {n} in this file are already on this device, unchanged.', { n: plural(parsed.entries.length, 'entry', 'entries') })}${skippedLine}`
        : `${source}
${t('The file has no expense rows.')}${skippedLine}`,
      confirmLabel: 'OK',
      hideCancel: true,
    });
    return null;
  }

  const lines = [
    plan.add.length && t('{n} new', { n: plan.add.length }),
    plan.update.length && t('{n} changed', { n: plan.update.length }),
    plan.remove.length && t('{n} deleted on the other device', { n: plan.remove.length }),
    plan.unchanged && t('{n} already here', { n: plan.unchanged }),
  ].filter(Boolean);
  const res = await confirmDialog({
    title: changes ? t('Import {n}?', { n: tn(changes, 'change', 'changes') }) : t('Restore deleted entries?'),
    message: `${source}
${lines.join(' · ') || 'No new entries.'}
Nothing is duplicated: entries are matched by ID.${skippedLine}`,
    option: plan.deletedHere.length ? { label: t('Also bring back {n} you deleted on this device', { n: plural(plan.deletedHere.length, 'entry', 'entries') }), checked: true } : null,
    confirmLabel: 'Import',
  });
  const confirmed = typeof res === 'object' ? res.confirmed : res;
  if (!confirmed) return null;
  const result = await applyMerge(plan, { restoreDeleted: typeof res === 'object' && res.option });
  if (parsed.settings) await mergeSettings(parsed.settings);
  await updateSettings({ lastImportAt: new Date().toISOString() }, { touch: false });
  const bits = [
    result.added && t('{n} new', { n: result.added }),
    result.updated && t('{n} updated', { n: result.updated }),
    result.restored && t('{n} restored', { n: result.restored }),
    result.removed && t('{n} removed', { n: result.removed }),
  ].filter(Boolean);
  toast(bits.length ? t('Imported: {what}', { what: bits.join(', ') }) : t('Nothing changed'));
  return result;
}

export function createSyncView() {
  const root = h('div', { class: 'view view-sync' });
  let lastResult = null;

  async function send(builder, { sync = false, share = false } = {}) {
    const { blob, filename } = builder(sync ? getAllIncludingDeleted() : getEntries());
    const how = await deliver(blob, filename, { preferShare: share });
    if (how === 'cancelled') return;
    if (sync) await updateSettings({ lastExportAt: new Date().toISOString() }, { touch: false });
    toast(how === 'shared' ? t('Sent') : t('Saved {file} to Downloads', { file: filename }));
    render();
  }

  function render() {
    clear(root);
    const s = getSettings();
    const count = getEntries().length;
    const sharing = canShareFiles();

    root.append(
      h('header', { class: 'view-head' }, [h('div', {}, [h('p', { class: 'eyebrow' }, 'Works without internet · No account needed'), h('h1', { class: 'view-title' }, 'Sync & export')])])
    );

    // ---- status / how it works ----
    root.appendChild(
      h('section', { class: 'glass card sync-hero' }, [
        h('div', { class: 'sync-path', 'aria-hidden': 'true' }, [
          h('span', { class: 'orb orb-lg', style: '--orb:var(--c-mint)' }, icon('phone', 24)),
          h('span', { class: 'sync-line' }, [h('span', { class: 'sync-packet' }, icon('file', 14))]),
          h('span', { class: 'orb orb-lg', style: '--orb:var(--c-blue)' }, icon('laptop', 24)),
        ]),
        h('p', { class: 'sync-lead' }, 'Your data is stored on this device only. To move it, send a sync file. It works without internet: Quick Share, Bluetooth, a USB cable, or AirDrop.'),
        h('div', { class: 'kv-grid' }, [
          kv('This device', s.deviceName || 'This device'),
          kv('Entries', String(count)),
          kv('Last sent', capitalize(relativeTime(s.lastExportAt))),
          kv('Last received', capitalize(relativeTime(s.lastImportAt))),
        ]),
      ])
    );

    // ---- send ----
    root.appendChild(
      h('section', { class: 'glass card' }, [
        cardHead('1 · Send from this device', 'Everything: entries, deletions, categories'),
        h('div', { class: 'btn-stack' }, [
          sharing
            ? h('button', { type: 'button', class: 'btn btn-primary btn-block', onClick: () => send(buildSyncFile, { sync: true, share: true }) }, [icon('share', 18), h('span', {}, 'Share sync file')])
            : null,
          h('button', { type: 'button', class: 'btn ' + (sharing ? 'btn-ghost' : 'btn-primary') + ' btn-block', onClick: () => send(buildSyncFile, { sync: true }) }, [icon('download', 18), h('span', {}, 'Save sync file')]),
        ]),
        h('p', { class: 'hint' }, sharing ? 'Share opens your phone’s share sheet. Pick Quick Share / Nearby Share or Bluetooth and choose your laptop.' : 'The file goes to your Downloads folder. Move it to the other device any way you like.'),
      ])
    );

    // ---- receive ----
    const fileInput = h('input', {
      type: 'file',
      accept: '.json,.xlsx,.csv,application/json,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      class: 'visually-hidden',
      onChange: async (e) => {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        lastResult = await importSyncFile(f);
        render();
      },
    });
    const drop = h('button', { type: 'button', class: 'dropzone', onClick: () => fileInput.click() }, [
      icon('upload', 26),
      h('span', { class: 'drop-title' }, 'Choose a file to import'),
      h('span', { class: 'drop-sub' }, 'Sync file (.json), Excel (.xlsx) or CSV · or drop it anywhere on this window'),
    ]);
    root.appendChild(
      h('section', { class: 'glass card' }, [
        cardHead('2 · Receive on the other device', 'Open this app there, then import'),
        drop,
        fileInput,
        lastResult
          ? h('div', { class: 'result-row' }, [
              resultPill(lastResult.added, 'new'),
              resultPill(lastResult.updated, 'updated'),
              resultPill(lastResult.restored, 'restored'),
              resultPill(lastResult.removed, 'removed'),
              resultPill(lastResult.unchanged, 'unchanged'),
            ])
          : null,
        h('p', { class: 'hint' }, 'Any file exported here can be imported back, including an Excel or CSV you edited in a spreadsheet (edited rows update, new rows are added). Entries are matched by ID, so nothing duplicates.'),
      ])
    );

    // ---- analysis ----
    root.appendChild(
      h('section', { class: 'glass card' }, [
        cardHead('Export for analysis', 'Opens in Excel, Google Sheets, Numbers · can be imported back'),
        h('div', { class: 'export-grid' }, [
          exportTile('table', 'Excel workbook', 'Transactions · Monthly · Categories · Daily', () => send(buildWorkbook, { share: canShareFiles() })),
          exportTile('file', 'CSV', 'For Google Sheets, Python, R. For Excel, use the Excel workbook above', () => send(buildCsv, { share: canShareFiles() })),
        ]),
      ])
    );

    // ---- migration from old versions ----
    const token = oldCloudSpaceToken();
    const linkInput = h('input', { type: 'text', class: 'input', placeholder: 'Paste your old access link (…#s=…)', value: token ? `#s=${token}` : '' });
    root.appendChild(
      h('details', { class: 'glass card legacy', open: !count && !!token }, [
        h('summary', {}, [h('span', {}, 'Import from the old Ledger version'), icon('chevronDown', 18)]),
        h('p', { class: 'hint' }, 'The old version kept data in a Firebase cloud. Pull it in once (needs internet this one time). Running it again won’t duplicate anything.'),
        h('div', { class: 'inline-form' }, [
          linkInput,
          h('button', { type: 'button', class: 'btn btn-primary btn-sm', onClick: (e) => pullCloud(e.currentTarget, linkInput.value) }, 'Pull'),
        ]),
        h('button', { type: 'button', class: 'btn btn-ghost btn-block', onClick: pullOldLocal }, [icon('phone', 18), h('span', {}, 'Import very old data saved on this device')]),
      ])
    );
  }

  async function pullCloud(btn, text) {
    const token = tokenFromLink(text) || oldCloudSpaceToken();
    if (!token) {
      toast('That doesn’t look like an access link');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Pulling…';
    try {
      const { entries, meta } = await readOldCloudEntries(token);
      lastResult = await mergeEntries(entries);
      if (meta?.customNonFoodCategories?.length) {
        await mergeSettings({ customCategories: { non_food: meta.customNonFoodCategories }, excludedLocations: meta.excludedLocations, excludedItemNames: meta.excludedItemNames });
      }
      await updateSettings({ legacyDismissed: true }, { touch: false });
      toast(t('Imported {n} from the old cloud', { n: tn(lastResult.added, 'entry', 'entries') }));
    } catch (err) {
      await confirmDialog({ title: 'Couldn’t reach the old cloud', message: err.message, confirmLabel: 'OK' });
    }
    render();
  }

  async function pullOldLocal() {
    const legacy = await readOldLocalEntries();
    if (!legacy.length) {
      toast('No old data found on this device');
      return;
    }
    lastResult = await mergeEntries(legacy);
    toast(t('Imported {n} old entries', { n: lastResult.added }));
    render();
  }

  function cardHead(title, sub) {
    return h('div', { class: 'card-head' }, [h('h2', { class: 'card-title' }, title), sub ? h('span', { class: 'card-sub' }, sub) : null]);
  }
  function kv(label, value) {
    return h('div', { class: 'kv' }, [h('span', { class: 'kv-label' }, label), h('span', { class: 'kv-value' }, value)]);
  }
  function resultPill(n, label) {
    return h('span', { class: 'result-pill' + (n ? ' is-on' : '') }, [h('strong', {}, String(n)), ` ${t(label)}`]);
  }
  function exportTile(iconName, title, sub, onClick) {
    return h('button', { type: 'button', class: 'export-tile', onClick }, [
      h('span', { class: 'orb orb-md', style: '--orb:var(--c-lilac)' }, icon(iconName, 20)),
      h('span', { class: 'export-text' }, [h('strong', {}, title), h('span', {}, sub)]),
      icon('download', 18),
    ]);
  }

  subscribe(() => !root.hidden && render());
  render();
  return { root, activate: render, deactivate() {} };
}
