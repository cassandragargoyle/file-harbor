# Backup & Restore — Implementation Plan

A minimal, get-it-done implementation so you have a safety net while developing. No new dependencies. No zip format (yet). Just a folder copy with metadata, wired into the menu.

## Approach: Folder-Based Backup

Instead of the `.fhbackup` zip archive described in the full design doc, this implementation copies the workspace to a plain folder. Why:

- **Zero dependencies** — uses `fsp.cp()` (Node 16.7+, available in Electron 35)
- **Inspectable** — you can browse the backup folder directly in Finder
- **Fast** — no compression overhead
- **Trivially restorable** — copy back

The zip/archive format is a polish item for later. A plain folder backup is functionally identical for a single-user safety net.

### What Gets Backed Up

```
{user-chosen-destination}/
├── db.sqlite              # copied after WAL checkpoint
├── objects/               # all stored files (excludes .tmp/)
│   ├── abc123.pdf
│   └── def456.png
└── backup-meta.json       # when, what, how many
```

### What Gets Excluded

- `objects/.tmp/` — incomplete ingestions
- `logs/` — not needed
- `db.sqlite-wal`, `db.sqlite-shm` — flushed into `db.sqlite` via WAL checkpoint before copy

---

## Implementation Steps

### Step 1: Add `walCheckpoint()` to `DatabaseService`

**File:** `src/main/services/database.ts`

Add one method:

```ts
walCheckpoint(): void {
  this.sqlite.pragma('wal_checkpoint(TRUNCATE)');
}
```

This flushes all WAL data into `db.sqlite` so we can copy a single file and get a consistent database. Must be called before backup.

---

### Step 2: Create `backup-service.ts`

**New file:** `src/main/services/backup-service.ts`

Two exported functions:

#### `createBackup(libraryPath: string, destinationPath: string): Promise<BackupMeta>`

```
1. Create destination directory
2. Copy db.sqlite → destination/db.sqlite
3. Copy objects/ → destination/objects/ (excluding .tmp/ subdirectory)
4. Write backup-meta.json with: version, createdAt, appVersion, documentCount, totalSizeBytes
5. Return the BackupMeta object
```

The `fsp.cp()` call with `{ recursive: true, filter }` handles the .tmp exclusion — the filter callback skips any path containing `objects/.tmp`.

#### `restoreBackup(backupPath: string, libraryPath: string): Promise<BackupMeta>`

```
1. Read and validate backup-meta.json (throw if missing or unparseable)
2. Verify backup has db.sqlite and objects/ (throw if missing)
3. Remove existing db.sqlite from libraryPath
4. Remove existing objects/ from libraryPath
5. Copy backup/db.sqlite → libraryPath/db.sqlite
6. Copy backup/objects/ → libraryPath/objects/
7. Return the BackupMeta for confirmation messaging
```

#### `validateBackup(backupPath: string): Promise<BackupMeta>`

Lightweight check — reads `backup-meta.json`, confirms `db.sqlite` and `objects/` exist. Used to show the user what they're about to restore before committing.

#### Types

```ts
interface BackupMeta {
  version: number;       // 1
  createdAt: string;     // ISO 8601
  appVersion: string;    // from package.json or app.getVersion()
  documentCount: number;
  totalSizeBytes: number;
}
```

~60-80 lines of code total for this file.

---

### Step 3: Add IPC channels

**File:** `src/main/ipc-channels.ts`

```ts
// Backup
WORKSPACE_BACKUP: 'workspace:backup',
WORKSPACE_RESTORE: 'workspace:restore',
```

---

### Step 4: Add IPC handlers

**File:** `src/main/ipc-handlers.ts`

#### `WORKSPACE_BACKUP`

```
1. Guard: return early if no db or libraryPath
2. Show folder save dialog (dialog.showOpenDialog with createDirectory + openDirectory)
   - Default path: ~/Desktop
   - The handler creates a timestamped subfolder inside the chosen directory:
     file-harbor-backup-{workspace-name}-{YYYY-MM-DD}
3. Call db.walCheckpoint()
4. Call createBackup(libraryPath, destinationPath)
5. Return { success: true, path: destinationPath, meta: BackupMeta }
   or { success: false, error: string }
```

#### `WORKSPACE_RESTORE`

```
1. Guard: return early if no db or libraryPath
2. Show folder open dialog (dialog.showOpenDialog with openDirectory)
3. Call validateBackup(selectedPath) — if invalid, return error
4. Show confirmation dialog (dialog.showMessageBox):
   "Restore from backup? This will replace all documents in the current workspace.
    Backup from {date} with {n} documents."
   [Cancel] [Restore]
5. If confirmed:
   a. Teardown current services (calls.teardownServices)
   b. Call restoreBackup(backupPath, libraryPath)
   c. Re-initialize services (callbacks.initializeServices with current workspace)
   d. Notify renderer: send WORKSPACE_SWITCHED to trigger full reload
6. Return { success: true, meta: BackupMeta }
   or { success: false, error: string }
```

The teardown/reinitialize dance is needed because SQLite holds a lock on `db.sqlite`. We must close the database connection before replacing the file, then open a fresh connection afterwards. The same `teardownServices` / `initializeServices` pattern used by `switchWorkspace` handles this cleanly.

---

### Step 5: Wire preload + renderer IPC

**File:** `src/preload/preload.ts`

```ts
backupWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_BACKUP),
restoreWorkspace: () => ipcRenderer.invoke(IPC.WORKSPACE_RESTORE),
```

**File:** `src/renderer/lib/ipc.ts`

```ts
export const backupWorkspace = (): Promise<BackupResult> => api.backupWorkspace();
export const restoreWorkspace = (): Promise<RestoreResult> => api.restoreWorkspace();
```

---

### Step 6: Add menu items

**File:** `src/main/menu.ts`

Add to the File submenu, after "Open Library Folder" and before the separator:

```ts
{ type: 'separator' },
{
  label: 'Back Up Workspace...',
  click: () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send(IPC_CHANNELS.MENU_BACKUP);
  },
},
{
  label: 'Restore from Backup...',
  click: () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) win.webContents.send(IPC_CHANNELS.MENU_RESTORE);
  },
},
```

Wait — actually, since backup and restore are fully handled by the main process (dialogs, file operations, service teardown), these can invoke the IPC handlers directly from the menu click without going through the renderer at all. Simpler approach:

```ts
{
  label: 'Back Up Workspace...',
  click: async () => {
    // Invoke the handler directly — no renderer round-trip needed
    const win = BrowserWindow.getFocusedWindow();
    // ... or trigger via ipcMain.emit / direct function call
  },
},
```

Actually, the cleanest pattern that matches the existing codebase: have the menu send an event to the renderer, the renderer calls the IPC invoke, then shows a toast with the result. This keeps the renderer in the loop for toast feedback without needing new menu-specific IPC event channels.

**Simplest path:** Just add two more menu event channels (`MENU_BACKUP`, `MENU_RESTORE`) and handle them the same way `MENU_IMPORT_FILES` works — renderer listens, calls the invoke, shows a toast.

Add to `ipc-channels.ts`:
```ts
MENU_BACKUP: 'menu:backup',
MENU_RESTORE: 'menu:restore',
```

Add to `preload.ts`:
```ts
onMenuBackup: (callback: () => void) => { ... },
onMenuRestore: (callback: () => void) => { ... },
```

Add to `renderer/lib/ipc.ts`:
```ts
export const onMenuBackup = (cb: () => void) => api.onMenuBackup(cb);
export const onMenuRestore = (cb: () => void) => api.onMenuRestore(cb);
```

---

### Step 7: Renderer — subscribe to menu events + show toasts

**File:** `src/renderer/App.tsx`

In the existing `useEffect` that subscribes to menu events, add:

```ts
const cleanupBackup = onMenuBackup(async () => {
  const result = await backupWorkspace();
  if (result.success) {
    toast.success(`Backup created (${result.meta.documentCount} documents)`);
  } else {
    toast.error(`Backup failed: ${result.error}`);
  }
});

const cleanupRestore = onMenuRestore(async () => {
  const result = await restoreWorkspace();
  if (result.success) {
    toast.success(`Restored ${result.meta.documentCount} documents from backup`);
    // Refresh document list
    loadDocuments();
    loadCounts();
  } else if (result.error) {
    toast.error(`Restore failed: ${result.error}`);
  }
  // result.error being absent means user cancelled — no toast needed
});
```

---

## File Summary

| File | Change |
|---|---|
| `src/main/services/database.ts` | Add `walCheckpoint()` method (1 line) |
| `src/main/services/backup-service.ts` | **New file** — `createBackup`, `restoreBackup`, `validateBackup` (~70 lines) |
| `src/main/ipc-channels.ts` | Add 4 channels: `WORKSPACE_BACKUP`, `WORKSPACE_RESTORE`, `MENU_BACKUP`, `MENU_RESTORE` |
| `src/main/ipc-handlers.ts` | Add 2 handlers (~50 lines) |
| `src/preload/preload.ts` | Add 4 bridge methods (backup, restore, onMenuBackup, onMenuRestore) |
| `src/renderer/lib/ipc.ts` | Add 4 wrappers |
| `src/main/menu.ts` | Add 2 menu items + separator |
| `src/renderer/App.tsx` | Subscribe to menu events, call IPC, show toasts (~20 lines) |

**Total: ~150 lines of new code across 8 files, 1 new file.**

---

## What This Doesn't Include (Save for Later)

- **Zip/archive format** — backups are folders, not `.fhbackup` files. Fine for local use; less portable for sharing.
- **Progress reporting** — for typical workspace sizes this will complete in seconds. If libraries grow to thousands of files, add a progress bar later.
- **Restore to new workspace** — this version only restores into the current workspace. Creating-a-new-workspace-from-backup is a separate enhancement.
- **Welcome screen restore** — restore from the onboarding flow for fresh installs.
- **Automatic/scheduled backups** — manual only for now.
- **Checksum verification** — `backup-meta.json` doesn't include a checksum. The folder copy is reliable enough for local backups; add integrity checks when moving to the archive format.
