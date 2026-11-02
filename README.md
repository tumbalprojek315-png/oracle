# Oracle

Offline-first expense tracker (installable web app). Your data is stored **on
the device**, not in a cloud. There's no account and no internet needed. To move
data between your phone and laptop you send a **sync file**, which also works
offline (Quick Share, Bluetooth, USB cable, AirDrop).

## Phone → laptop, the everyday flow

1. **Phone:** Sync tab → **Share sync file** → pick Quick Share / Bluetooth →
   your laptop. (Or **Save sync file**, then copy it over USB.)
2. **Laptop:** open Oracle → drag the `oracle-sync_….json` file onto the window
   (or Sync tab → **Choose a sync file**) → **Merge**.

Merging matches entries by ID. New entries are added, and for an edited
entry the newer version wins. Deletions carry over too. Importing the same
file twice changes nothing, so it's always safe. To make both devices
identical, sync in both directions.

## Analysing your spending

- **Insights tab:** totals, day-by-day and weekday patterns, categories,
  payment methods, 6-month trend, top items and places, plus a Food view with
  meal-time analysis.
- **Sync tab → Excel workbook** (`.xlsx`, opens in Excel, Google Sheets or
  LibreOffice), with four sheets:
  - *Transactions*: one row per expense, with real dates, Year / Month / ISO week /
    weekday columns, numeric amounts, filters and a frozen header.
  - *Monthly*: Food / Non-food / Fixed per month (+ budget left if set).
  - *Categories*: count, total, average and share.
  - *Daily*: total per day.
- **CSV:** the Transactions table for Google Sheets, pandas, R, and so on. For
  Excel use the workbook instead: Excel set to Indonesian/European number
  format expects `;`-separated CSVs and would put everything in one column.

**Everything exported can be imported back** (Sync → *Choose a file to
import*): the sync `.json`, the Excel `.xlsx` and the `.csv`, including an
Excel file you edited and saved in Excel. Edited rows update and new rows are
added; entries are matched by ID, so nothing duplicates. If the file contains
entries you deleted on this device, the import asks whether to bring them back
(this is how you restore a backup).

## Deleting entries

Activity → **Select** → tap entries, or **Select all** → **Delete**. You have to
tick "I understand … will be permanently deleted" before the Delete button
works, and there's a short Undo afterwards. Deletions also reach your other
devices on the next sync.

## Run it on your laptop

Needs Node.js (nothing to install):

```bash
node dev-server.mjs
```

Open `http://localhost:5173`. Press **N** to add an expense; you can type the
amount on your keyboard.

## Put it on your phone (one time)

A phone can only install the app and run it offline from an **HTTPS** address,
so host this folder once on any free static host:

- **Netlify Drop** (easiest): go to app.netlify.com/drop and drag this folder in.
- or GitHub Pages / Cloudflare Pages / Vercel.

Open the URL on your phone → Chrome ⋮ → **Install app** (iPhone: Share →
**Add to Home Screen**). After that it opens and works with no internet.

Data belongs to the address it was saved under. If you ever change the
hosting URL, move your data over with a sync file.

## Coming from the old "Ledger" version

The old version stored data in Firebase. On the device you used it on,
open Oracle → Sync → **Import from the old Ledger version** → **Pull** (needs
internet once; the old access link is filled in automatically if this
browser has it). Running it again won't duplicate anything. The original code
is saved in `backup/ledger-v1-original.zip`.

## Structure

- `index.html`, `manifest.webmanifest`, `service-worker.js`: app shell and offline support (network-first, so updates show up automatically).
- `src/db.js`: IndexedDB storage. `src/store.js`: entries, settings, merge logic and aggregates.
- `src/transfer.js`: sync file, CSV and Excel exports, import parsing. `src/xlsx.js`: a tiny dependency-free .xlsx writer.
- `src/legacy.js`: one-time import from the old versions.
- `src/views/`: Home, Activity, Insights, Sync, Settings. `src/components/`: form, keypad, charts, sheets.
- `scripts/generate-icons.mjs`: regenerates the PNG app icons.
