# Import Summary Dialog

## Context

When importing files (especially via folder import or multi-file drag-and-drop), errors, duplicates, and skipped files are reported as transient toast notifications that auto-dismiss. If a user imports a large folder where a few files fail, they may never notice — and assume all files are safely stored. This change replaces toasts with a persistent summary dialog for batch imports that requires user acknowledgment.

## Approach

### New component: `ImportSummaryDialog`

**File:** `src/renderer/components/inbox/ImportSummaryDialog.tsx`

A modal dialog (following the `BatchFileDialog` / `DeleteDialog` pattern) that shows the outcome of a batch import. Displayed after any import that involves **more than one file** OR **any non-success result** (error, duplicate, skipped). Single-file successes still get a simple toast.

**Layout:**
- Header: "Import Complete"
- Summary stats bar: `X imported · Y duplicates · Z failed · W skipped` (with color coding — green/neutral/red/neutral)
- Detail sections (only shown when count > 0):
  - **Failed** (red) — list of filenames + error reason. Shown prominently so failures are front and center.
  - **Duplicates** (neutral) — list of filenames
  - **Skipped** (neutral) — count only (these are unsupported file types from directory recursion, individual names aren't available from the current return type)
- Footer: single "OK" button to dismiss

### Changes to `App.tsx`

- Add state: `const [importSummary, setImportSummary] = useState<{results: IngestResult[]; skippedCount: number} | null>(null)`
- In `handleImportAction` and `handleImportFolderAction`: instead of calling `showIngestToasts()`, check if a dialog is warranted. If so, set `importSummary`. Otherwise show a simple toast for the trivial case.
- Render `ImportSummaryDialog` conditionally when `importSummary` is non-null.
- On dialog close, clear the state.

### Changes to `DropZone.tsx`

The DropZone also calls `showIngestToasts()` directly. It needs to surface import results back up to `App.tsx` so the dialog can be shown.

Add an `onImportComplete` callback prop to `DropZone` that passes `{results, skippedCount}` up to App. Minimal change — DropZone still handles the drop event but delegates result display to the parent.

### Logic for when to show dialog vs toast

```
const success = results.filter(r => r.status === 'success').length;

if (results.length === 0 && skippedCount === 0) {
  toast('No supported files found');
} else if (results.length === 1 && success === 1 && skippedCount === 0) {
  toast.success('1 document imported');
} else {
  setImportSummary({ results, skippedCount });
}
```

Single successful import = toast. Everything else (multi-file, any errors/duplicates/skipped) = dialog.

### `showIngestToasts` cleanup

Keep the function in `toast-helpers.ts` for now (the watched folder single-file import in `App.tsx` still uses a toast independently). But remove it from the file picker, folder import, and drop zone paths.

## Files to modify

1. **Create** `src/renderer/components/inbox/ImportSummaryDialog.tsx` — new dialog component
2. **Edit** `src/renderer/App.tsx` — add summary state, swap `showIngestToasts` for dialog logic, render dialog, pass callback to DropZone
3. **Edit** `src/renderer/components/inbox/DropZone.tsx` — add `onImportComplete` prop, call it instead of `showIngestToasts`

## Verification

1. **Folder import** with a mix of supported/unsupported files — dialog should appear showing imported count, skipped count
2. **Drag-and-drop multiple files** including a duplicate — dialog should show success + duplicate counts
3. **Single file drag-and-drop** (new file) — should still show a simple toast, not the dialog
4. **All duplicates** — dialog should appear, showing 0 imported, N duplicates
5. **Watched folder** auto-import — should still show the existing per-file toast (unchanged)
6. **Dialog dismiss** — clicking OK or clicking backdrop should close the dialog
