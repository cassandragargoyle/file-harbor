# Export All Files — Implementation Plan

## Context

Users can only export one document at a time via right-click context menu. There's no bulk export. This adds a **File menu → "Export All Files..."** action that exports every document into a clean, human-readable folder structure organized by category, with an export manifest.

**Decisions made:**
- File menu only (no settings page)
- Folder export only (no zip)
- Manifest only (no extracted text)
- No options dialog — sensible defaults (category folders, include inbox, include manifest)

## Files to Modify

| File | Change |
|---|---|
| `src/main/ipc-channels.ts` | Add `DOCUMENTS_EXPORT_ALL` and `MENU_EXPORT_ALL` channels |
| `src/main/menu.ts` | Add "Export All Files..." menu item |
| `src/main/services/database.ts` | Add `getAllDocuments()` method |
| `src/main/services/file-service.ts` | Add `exportAllFiles()` function |
| `src/main/ipc-handlers.ts` | Add handler for `DOCUMENTS_EXPORT_ALL` |
| `src/preload/preload.ts` | Add `exportAllDocuments` + `onMenuExportAll` bridge methods |
| `src/renderer/lib/ipc.ts` | Add `exportAllDocuments` + `onMenuExportAll` wrappers |
| `src/shared/types.ts` | Add `ExportAllResult` type |
| `src/renderer/App.tsx` | Wire menu event to call export, show toast |

## Implementation Steps

### 1. Add types (`src/shared/types.ts`)

```ts
export interface ExportAllResult {
  success: boolean;
  exported?: number;
  failed?: number;
  path?: string;
  error?: string;
}
```

### 2. Add IPC channels (`src/main/ipc-channels.ts`)

Add to `IPC_CHANNELS`:
- `DOCUMENTS_EXPORT_ALL: 'documents:export-all'`
- `MENU_EXPORT_ALL: 'menu:export-all'`

### 3. Add `getAllDocuments()` to database (`src/main/services/database.ts`)

Simple query: `select().from(schema.documents).all()` — returns all documents for snapshot at export start.

### 4. Add `exportAllFiles()` to file-service (`src/main/services/file-service.ts`)

Core export logic as a standalone function:

```
exportAllFiles(libraryPath, documents, destinationRoot, workspaceName, appVersion)
```

**Filename resolution** (per spec priority):
1. `suggested_filename` when `suggestion_outcome === 'accepted'` — append extension from `stored_path`
2. `original_filename`
3. `{id}{extension}` fallback

**Sanitization:** Strip `/\:*?"<>|` and null bytes from filenames. Truncate to 200 chars.

**Collision handling:** Track used names per directory. On collision: `name (2).ext`, `name (3).ext`, etc.

**Folder structure:**
- `Export_YYYY-MM-DD/{Category}/filename.ext`
- Uncategorized docs → `Inbox/`
- Create category subdirs on demand

**Copy loop:** Use `setImmediate` between copies to yield to event loop. Catch per-file errors (missing files, ENOSPC) — skip and count failures.

**Manifest:** Write `export-manifest.json` at the root with `exportedAt`, `appVersion`, `workspaceName`, `documentCount`, and per-document entries (`exportedFilename`, `originalFilename`, `category`, `addedAt`, `sizeBytes`, `contentHash`).

### 5. Add IPC handler (`src/main/ipc-handlers.ts`)

Follow the backup handler pattern:
1. Guard: `if (!state.db || !state.libraryPath)` return error
2. Snapshot all documents via `getAllDocuments()`
3. Show `dialog.showOpenDialog` with `openDirectory` + `createDirectory`
4. Build timestamped destination path: `Export_YYYY-MM-DD`
5. Call `exportAllFiles()`
6. Return `ExportAllResult`

### 6. Add preload bridge (`src/preload/preload.ts`)

- `exportAllDocuments: () => ipcRenderer.invoke(IPC.DOCUMENTS_EXPORT_ALL)`
- `onMenuExportAll: (callback) => ipcRenderer.on(IPC.MENU_EXPORT_ALL, handler)` — return cleanup

### 7. Add renderer IPC wrapper (`src/renderer/lib/ipc.ts`)

- `exportAllDocuments(): Promise<ExportAllResult>`
- `onMenuExportAll(cb): () => void`

### 8. Add menu item (`src/main/menu.ts`)

Insert "Export All Files..." after the backup/restore section with a separator.

### 9. Wire in App.tsx (`src/renderer/App.tsx`)

Add cleanup listener in the same `useEffect` as other menu handlers:

```ts
const cleanupMenuExportAll = ipc.onMenuExportAll(async () => {
  const result = await ipc.exportAllDocuments();
  if (result.success) {
    toast.success(`Exported ${result.exported} documents to folder`);
    if (result.failed && result.failed > 0) {
      toast.error(`${result.failed} files could not be exported`);
    }
  } else if (result.error) {
    toast.error(`Export failed: ${result.error}`);
  }
});
```

Return cleanup in the effect teardown.

## Verification

1. Build: `npm run build` (or equivalent) should pass with no type errors
2. Manual test: File → Export All Files... → pick a folder → verify:
   - Timestamped root folder created
   - Category subfolders present
   - Files named by priority (suggested → original → UUID)
   - No collisions (duplicates get `(2)`, `(3)` suffix)
   - `export-manifest.json` present and valid JSON
   - Missing source files logged as failures, not crashes
