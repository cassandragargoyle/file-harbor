# Recursive Directory Import

## Overview

Allow users to select entire directories and recursively import all supported files within them (including nested subdirectories).

## Current State

The ingestion pipeline already accepts an array of file paths, handles deduplication via SHA-256 content hashing, and reports per-file results. The main work is **resolving directories into file paths** before feeding them into the existing pipeline.

Three import entry points exist today:
- **File picker dialog** — `dialog.showOpenDialog` with `openFile` + `multiSelections`
- **Drag-and-drop** — `DropZone` component extracts paths from DataTransfer
- **Watched folder** — chokidar monitors a folder (depth: 0, top-level only)

None of these currently handle directories.

## Changes Required (by layer)

### 1. Directory resolver utility

A new function (in `file-service.ts` or a new `directory-resolver.ts`) that:
- Takes a mix of file and directory paths
- Recursively walks directories using `fs.readdir` with `{ recursive: true }`
- Filters to only `ACCEPTED_EXTENSIONS`
- Skips dotfiles, `.DS_Store`, OS temp files (same ignore list as `watcher-service.ts`)
- Returns a flat list of absolute file paths

~30-50 lines of code.

### 2. Ingest IPC handler (`ipc-handlers.ts`)

Currently `DOCUMENTS_INGEST_FILES` receives `filePaths: string[]` and assumes they are all files. Update to call the directory resolver on the incoming paths before entering the existing ingestion loop. Directories get expanded; plain files pass through unchanged.

### 3. Folder picker dialog (`ipc-handlers.ts`)

New IPC handler for `DOCUMENTS_OPEN_FOLDER_PICKER`. Uses `dialog.showOpenDialog` with `properties: ['openDirectory']`.

macOS does not allow `openFile` and `openDirectory` simultaneously in the same dialog, so a separate "Import Folder..." action is required.

### 4. IPC plumbing (one-liners across 3 files)

| File | Change |
|---|---|
| `ipc-channels.ts` | Add `DOCUMENTS_OPEN_FOLDER_PICKER` |
| `preload.ts` | Add `openFolderPicker` bridge method |
| `renderer/lib/ipc.ts` | Add `openFolderPicker` wrapper |

### 5. Menu item (`menu.ts`)

Add **"Import Folder..."** under File, next to "Import Files...". Suggested shortcut: `CmdOrCtrl+Shift+I`.

### 6. Renderer — UI entry points

| File | Change |
|---|---|
| `App.tsx` | Add `handleImportFolderAction` callback (mirrors `handleImportAction`) |
| `menu.ts` / `ipc-channels.ts` | Add `MENU_IMPORT_FOLDER` event channel |
| `DropZone.tsx` | Detect dropped directories via `fs.stat` (through a new IPC call or preload util), resolve them, then pass flat file list to `ingestFiles` |
| TopBar or Sidebar | Optionally add an "Import Folder" button or dropdown option |

### 7. Progress reporting (optional, can defer)

For large directory imports (hundreds/thousands of files), the current batch-then-toast approach works but gives no progress feedback. A future enhancement could add:
- A progress IPC event stream from main → renderer
- A progress bar or "Importing 47/312 files..." indicator
- Periodic yielding to the event loop in the ingest loop to keep the app responsive

## Edge Cases

- **Duplicate filenames across directories** — Two files with the same name (e.g. `Documents/2024/invoice.pdf` and `Documents/2025/invoice.pdf`) are already handled correctly by the pipeline: each gets a unique UUID for storage, and deduplication is based on content hash, not filename. If the content differs, both are imported. The UX concern is that the user ends up with multiple identically-named documents in their inbox. A future enhancement could preserve the relative directory path in the display name (e.g. `2024/invoice.pdf`) or append a disambiguator, but for v1 the existing behavior is fine — users can rename after import.
- **Unsupported file types** — Directories will inevitably contain files the app doesn't handle (`.exe`, `.zip`, `.DS_Store`, config files, etc.). The directory resolver should **silently skip** anything not in `ACCEPTED_EXTENSIONS` rather than reporting each one as an error. This is different from the file picker flow, where the user explicitly chose a file and should be told it's unsupported. If a directory (or tree) contains *zero* supported files after filtering, show a toast like "No supported files found in folder". Optionally, the ingest result summary could mention how many files were skipped (e.g. "12 documents imported, 34 unsupported files skipped") so the user knows the app saw the other files and intentionally ignored them.
- **Symlink loops** — `fs.readdir({ recursive: true })` follows symlinks; consider tracking visited inodes or using `realpath` to detect cycles
- **Permission errors** — some subdirectories may be unreadable; skip and include in error results
- **Very large directories** — thousands of files processed sequentially could block the main process event loop; consider batching or `setImmediate` yields between files
- **Empty directories** — resolve to zero files; show an appropriate toast ("No supported files found")
- **macOS file picker** — cannot mix `openFile` + `openDirectory` in one dialog; separate actions required

## Effort Estimate

| Layer | Files | Complexity |
|---|---|---|
| Directory resolver | 1 new/extended | Low (~30-50 lines) |
| Ingest handler update | `ipc-handlers.ts` | Low |
| Folder picker dialog | `ipc-handlers.ts` | Low (~15 lines) |
| IPC plumbing | 3 files | Trivial (one-liners) |
| Menu item | `menu.ts` | Trivial |
| Renderer callbacks | `App.tsx` | Low |
| DropZone directory detection | `DropZone.tsx` | Low-medium |
| Progress reporting | Multiple | Medium (deferrable) |

**Overall: ~100-150 lines of new code across ~7 files** for the core feature (folder picker + recursive walk + existing pipeline). Progress reporting can be layered on later.

## Implementation Plan

### Step 1: Add `resolveFilePaths()` to `file-service.ts`
- `stat` each incoming path; directories get recursively walked, files pass through
- Filter to `ACCEPTED_EXTENSIONS`, skip ignored patterns (dotfiles, `.DS_Store`, Office temp files, etc.)
- Return `{ filePaths: string[], skippedCount: number }`

### Step 2: Update ingest IPC handler (`ipc-handlers.ts`)
- Call `resolveFilePaths()` on incoming paths before the ingestion loop
- Change return shape to `{ results: IngestResult[], skippedCount: number }`

### Step 3: Add IPC channels (`ipc-channels.ts`)
- `DOCUMENTS_OPEN_FOLDER_PICKER: 'documents:open-folder-picker'`
- `MENU_IMPORT_FOLDER: 'menu:import-folder'`

### Step 4: Add folder picker handler (`ipc-handlers.ts`)
- `dialog.showOpenDialog({ properties: ['openDirectory'] })`

### Step 5: Wire preload + renderer IPC bridge
- `preload.ts`: add `openFolderPicker`, `onMenuImportFolder`
- `renderer/lib/ipc.ts`: add matching wrappers

### Step 6: Add "Import Folder..." menu item (`menu.ts`)
- After "Import Files...", accelerator `CmdOrCtrl+Shift+I`

### Step 7: Renderer changes (`App.tsx`)
- Add `handleImportFolderAction` callback
- Subscribe to `onMenuImportFolder` menu event

### Step 8: Update toast helpers (`toast-helpers.ts`)
- Accept optional `skippedCount`, show "X unsupported files skipped" toast

### Step 9: Update all callers for new return shape
- `App.tsx` and `DropZone.tsx`: destructure `{ results, skippedCount }`

### Files modified
| File | Change |
|---|---|
| `src/main/services/file-service.ts` | Add `resolveFilePaths()` |
| `src/main/ipc-handlers.ts` | Resolve dirs before ingest; add folder picker; new return shape |
| `src/main/ipc-channels.ts` | Add 2 channels |
| `src/preload/preload.ts` | Add `openFolderPicker`, `onMenuImportFolder` |
| `src/renderer/lib/ipc.ts` | Add 2 wrappers |
| `src/main/menu.ts` | Add "Import Folder..." item |
| `src/renderer/App.tsx` | Add folder import handler + menu subscription |
| `src/renderer/lib/toast-helpers.ts` | Handle `skippedCount` |
| `src/renderer/components/inbox/DropZone.tsx` | Update for new return shape |
