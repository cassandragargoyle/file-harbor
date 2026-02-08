# File Harbor - Phased Technical Implementation Plan

## Context

Build a desktop "Document Cabinet" app for a single user who wants to organize scattered digital documents into a clean local library. The app ingests files (drag-drop, file picker, watched folder), provides an Inbox for unfiled docs, files them into 12 fixed categories, previews PDFs/images, and supports filename + full-text search. Everything stays local, no network calls.

## Stack

| Layer | Choice | Version | Notes |
|-------|--------|---------|-------|
| Shell | Electron + Forge + Vite plugin | Electron ~39, Forge ~7.10 | Vite plugin is still marked experimental |
| Renderer | React + TypeScript | React 19, TS 5.x | No known Electron-specific issues with React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui | Tailwind 4.x | ESM-only `@tailwindcss/vite` — needs `.mts` renderer config |
| Database | better-sqlite3 + Drizzle ORM | better-sqlite3 ^12.6.0, drizzle-orm latest | Native module — pin version, externalize + ASAR unpack |
| State | zustand | 5.x | Renderer-only store + IPC for side effects |
| File watching | chokidar | 4.x (CJS+ESM) | Built-in `awaitWriteFinish` for stability detection |
| PDF preview | react-pdf | 10.x (ESM-only) | Bundled PDF.js worker (no network) |
| PDF text extraction | unpdf | latest | Replaces abandoned `pdf-parse` (unmaintained since 2019) |
| Category picker | cmdk | >= 1.0.4 | React 19 support added in 1.0.4+ |
| Toasts | sonner | latest | Used by craft-agents-oss, integrates well with shadcn |
| Icons | lucide-react | latest | Tree-shakeable icon set |
| Logging | electron-log | 5.x | Scoped loggers for main process |

## Key Technical Decisions (from research)

### Tailwind v4 ESM workaround
`@tailwindcss/vite` is ESM-only. Since Electron Forge projects are CommonJS by default, use a **`.mts` extension** for the renderer Vite config. This is the cleanest fix — Vite natively treats `.mts` as ESM regardless of package.json `type`. No async dynamic import hack needed.

### Native module handling (better-sqlite3)
Pin to `better-sqlite3@^12.6.0` — treat as a platform dependency, bump only deliberately. Three things must happen:
1. **Externalize** in `vite.main.config.ts` via `rollupOptions.external: ['better-sqlite3']`. Note: if Forge's Vite plugin tries to inline it anyway, you may need to also add it to the preload config or adjust the external pattern — test after initial setup.
2. **Rebuild** for Electron's Node version — Forge handles this via `@electron/rebuild` during packaging. Add `postinstall` script for dev: `electron-rebuild -f -w better-sqlite3`. Ensure dev and CI use the same Electron version to avoid rebuild mismatches.
3. **ASAR unpack** — native `.node` binaries can't load from inside ASAR. Use `@electron-forge/plugin-auto-unpack-natives`. Known issue [#3934](https://github.com/electron/forge/issues/3934) — fallback: manual `asar.unpackDir` in packagerConfig.

### Custom protocol (modern API)
`protocol.registerFileProtocol` is **deprecated** since Electron 25. Use `protocol.handle` + `net.fetch` + `pathToFileURL`:
```ts
protocol.handle('file-harbor', (request) => {
  const url = new URL(request.url);
  // Only allow objects/ path prefix
  const requestedPath = decodeURIComponent(url.pathname);
  if (!requestedPath.startsWith('/objects/')) {
    return new Response('Forbidden', { status: 403 });
  }
  const resolved = path.resolve(libraryRoot, requestedPath.slice(1)); // strip leading /
  // Verify resolved path stays within library (prevent traversal)
  if (!resolved.startsWith(path.join(libraryRoot, 'objects'))) {
    return new Response('Forbidden', { status: 403 });
  }
  return net.fetch(pathToFileURL(resolved).toString());
});
```
Must call `protocol.registerSchemesAsPrivileged` before `app.ready`.
**Windows caveat**: `pathToFileURL()` handles platform path differences correctly. Avoid manual `file://` URL construction — Electron has documented path encoding issues on Windows with custom protocols.

### PDF text extraction
`pdf-parse` (the original npm package) has been unmaintained since ~2019. Use **`unpdf`** by the UnJS team — modern, TypeScript-first, works across all JS runtimes.

### Drizzle migrations for desktop app
Generate migrations with `drizzle-kit generate` during development. Run them programmatically at app startup via `migrate()` from `drizzle-orm/better-sqlite3/migrator`. The **entire `drizzle/` directory** (not just `drizzle/migrations/`) must be bundled as `extraResource` — Drizzle requires the `meta/_journal.json` file to track applied migrations. Missing it causes silent failures that only surface in packaged builds.

Runtime path resolution:
```ts
const migrationsPath = app.isPackaged
  ? path.join(process.resourcesPath, 'drizzle')
  : path.join(app.getAppPath(), 'drizzle');
```

### File ingestion strategy: temp + hash + rename
Ingesting a file requires both hashing (for dedup) and copying (for storage). These are reconciled via a **temp file approach**:
1. Stream source file to a temp file in `objects/.tmp/` while computing SHA-256 hash simultaneously (single read pass)
2. After stream completes, check DB for existing hash
3. If duplicate: delete temp file, return duplicate status
4. If new: rename/move temp file to final `objects/<uuid>.<ext>` path, create DB record

This avoids both double-reads and wasted permanent writes.

### PDF text extraction: worker thread
PDF parsing is CPU-intensive and will block the main Electron process if run inline — even when "async". This causes IPC stalls, window freezes, and dropped events during large batches.

Solution: run `unpdf` extraction in a **Node `worker_threads` worker**:
- Main process queues extraction jobs after ingest
- Worker thread reads file, calls `extractText()`, returns text
- Main process updates DB record and emits event to renderer

This keeps the app responsive even when processing hundreds of PDFs.

### IPC architecture (pattern from craft-agents-oss)
Use a typed `IPC_CHANNELS` constant object for all channel names — provides type safety and a single source of truth. Preload exposes `electronAPI` via `contextBridge` with `contextIsolation: true`, `nodeIntegration: false`. Event listeners return cleanup functions to prevent memory leaks.

### Security in IPC handlers (pattern from craft-agents-oss)
Validate all file paths in IPC handlers:
- Must be absolute paths
- Must resolve within the library directory (prevent traversal)
- Resolve symlinks before checking

## Directory Structure

```
file-harbor/
  docs/
    mvp-requirements.md
    implementation-plan.md
  package.json
  tsconfig.json
  forge.config.ts
  forge.env.d.ts
  index.html
  vite.main.config.ts
  vite.preload.config.ts
  vite.renderer.config.mts          # .mts for ESM (Tailwind v4)
  drizzle.config.ts
  drizzle/
    migrations/                      # Generated by drizzle-kit
  .gitignore
  src/
    main/
      main.ts                        # Electron entry, window creation
      ipc-handlers.ts                # All ipcMain.handle registrations
      ipc-channels.ts                # Typed IPC_CHANNELS constant
      services/
        database.ts                  # Drizzle + better-sqlite3 + migrations
        file-service.ts              # Temp+hash+rename ingestion, delete, export
        watcher-service.ts           # chokidar watched folder
        pdf-extractor.ts             # Worker thread manager for text extraction
        pdf-worker.ts                # worker_threads script running unpdf
      lib/
        library-manager.ts           # Library folder init/validation
        settings.ts                  # Persistent settings JSON
        logger.ts                    # electron-log scoped loggers
    preload/
      preload.ts                     # contextBridge API with cleanup fns
    renderer/
      main.tsx                       # React entry (createRoot)
      App.tsx                        # Root layout + app state
      index.css                      # @import "tailwindcss" + base styles
      electron.d.ts                  # Window.electronAPI type declaration
      components/
        layout/
          Sidebar.tsx
          TopBar.tsx
          MainContent.tsx
        documents/
          DocumentList.tsx
          DocumentRow.tsx
          DocumentPreview.tsx
        inbox/
          DropZone.tsx
        filing/
          CategoryPicker.tsx
        onboarding/
          WelcomeScreen.tsx
        settings/
          SettingsDialog.tsx
        ui/                          # shadcn/ui components
      hooks/
        useKeyboardShortcuts.ts
      stores/
        app-store.ts                 # zustand
      lib/
        utils.ts                     # cn(), formatDate, formatBytes
        ipc.ts                       # Typed wrapper around window.electronAPI
    shared/
      types.ts                       # DocumentRecord, Category, IPC types
      schema.ts                      # Drizzle table definitions
      constants.ts                   # CATEGORIES, ACCEPTED_EXTENSIONS
```

---

## Phase 1: Project Scaffolding + Toolchain

**Goal:** Working Electron window with React 19 + Tailwind v4 rendering "File Harbor". Zero business logic — just proof the toolchain works end-to-end.

### Tasks

1. **Create `package.json`**
   - `"main": ".vite/build/main.js"`
   - Prod deps: `react`, `react-dom`, `better-sqlite3@^12.6.0` (pinned), `drizzle-orm`, `chokidar@^4`, `uuid`, `unpdf`, `zustand`, `cmdk`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `electron-squirrel-startup`, `@tailwindcss/vite`, `tailwindcss`, `sonner`, `electron-log`
   - Dev deps: `electron`, `@electron-forge/cli`, `@electron-forge/maker-zip`, `@electron-forge/maker-squirrel`, `@electron-forge/maker-deb`, `@electron-forge/maker-rpm`, `@electron-forge/plugin-vite`, `@electron-forge/plugin-fuses`, `@electron-forge/plugin-auto-unpack-natives`, `@electron-forge/shared-types`, `@electron/fuses`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `@types/better-sqlite3`, `@types/uuid`, `@types/node`, `ts-node`, `vite`, `drizzle-kit`, `@electron/rebuild`
   - Scripts: `start` (electron-forge start), `package`, `make`, `postinstall` (electron-rebuild -f -w better-sqlite3), `db:generate` (drizzle-kit generate), `db:push` (drizzle-kit push)

2. **Create `forge.config.ts`**
   - `packagerConfig.asar: true`
   - VitePlugin with build entries: `src/main/main.ts` (main), `src/preload/preload.ts` (preload)
   - Renderer: `main_window` pointing to `vite.renderer.config.mts`
   - AutoUnpackNativesPlugin for better-sqlite3
   - FusesPlugin (RunAsNode: false, CookieEncryption: true, etc.)
   - `extraResource: ['./drizzle']` — entire directory including `meta/_journal.json` (required for Drizzle migrator)

3. **Create Vite configs**
   - `vite.main.config.ts`: `rollupOptions.external: ['better-sqlite3']`
   - `vite.preload.config.ts`: minimal (Forge plugin handles most settings)
   - `vite.renderer.config.mts` (note `.mts`): import `react` from `@vitejs/plugin-react`, import `tailwindcss` from `@tailwindcss/vite`, configure both as plugins. Add resolve alias `'@': '/src/renderer'`

4. **Create `tsconfig.json`**
   - target: ES2022, module: commonjs, strict: true, esModuleInterop: true
   - jsx: react-jsx, lib: [ES2023, DOM, DOM.Iterable]
   - moduleResolution: node, resolveJsonModule: true, skipLibCheck: true

5. **Create `src/main/main.ts`**
   - Import `electron-squirrel-startup` (quit on Windows install/uninstall)
   - `createWindow()`: BrowserWindow 1200x800, `webPreferences: { preload, contextIsolation: true, nodeIntegration: false }`
   - macOS: `titleBarStyle: 'hiddenInset'` for native look
   - Load via `MAIN_WINDOW_VITE_DEV_SERVER_URL` (dev) or `path.join(__dirname, '../renderer/main_window/index.html')` (prod)
   - Standard macOS lifecycle: `window-all-closed` (quit on non-darwin), `activate` (recreate window)

6. **Create `src/preload/preload.ts`** — empty stub: `contextBridge.exposeInMainWorld('electronAPI', {})`

7. **Create `src/renderer/main.tsx`** — `createRoot(document.getElementById('root')!).render(<App />)`

8. **Create `src/renderer/App.tsx`** — simple component with Tailwind class

9. **Create `src/renderer/index.css`** — `@import "tailwindcss";` plus base body styles

10. **Create `index.html`** — `<div id="root"></div>`, `<script type="module" src="/src/renderer/main.tsx"></script>`

11. **Create `forge.env.d.ts`** — `/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />`

12. **Create `.gitignore`** — node_modules, out/, .vite/, dist/, .DS_Store, *.db

13. **Initialize git, install deps, run `npm start`**

### Verify
- `npm start` opens Electron window showing styled "File Harbor" text
- No TS errors, no console errors
- Tailwind utility classes work (test a color/spacing class)
- Hot reload works when editing App.tsx

---

## Phase 2: Core Data Layer (Database, File Ops, IPC)

**Goal:** Complete backend. Database, file ingestion with hashing, text extraction, settings persistence, and full IPC bridge. Testable from DevTools console.

### Tasks

1. **Define shared types** (`src/shared/types.ts`)
   - `DocumentSource = 'dragdrop' | 'watched_folder' | 'file_picker'`
   - `Category` union type: `'Identity' | 'Taxes' | ... | 'Other'`
   - `DocumentRecord` interface (all data model fields)
   - `IngestResult = { path: string; status: 'success' | 'duplicate' | 'error'; documentId?: string; error?: string }`

2. **Define shared constants** (`src/shared/constants.ts`)
   - `CATEGORIES` array with display info
   - `ACCEPTED_EXTENSIONS` and `ACCEPTED_MIME_TYPES`

3. **Define Drizzle schema** (`src/shared/schema.ts`)
   - `documents` sqliteTable: id (text, UUID), original_filename (text), stored_path (text), mime_type (text), size_bytes (integer), added_at (text, ISO), source (text), source_path (text, nullable), category (text, nullable), content_hash (text), extracted_text (text, nullable), updated_at (text)
   - Indexes on category, content_hash, added_at

4. **Create `drizzle.config.ts`** — dialect: sqlite, schema path, output: `./drizzle/migrations`

5. **Create database service** (`src/main/services/database.ts`)
   - Init: `new Database(dbPath)` + `drizzle(sqlite, { schema })` + `migrate(db, { migrationsFolder })`
   - Resolve migrationsFolder: `app.isPackaged ? path.join(process.resourcesPath, 'drizzle') : path.join(app.getAppPath(), 'drizzle')`
   - CRUD: insertDocument, getDocument, getDocumentsByCategory (null = Inbox), updateDocumentCategory, deleteDocument, searchDocuments (LIKE on filename + extracted_text), getDocumentByHash, getDocumentCounts (returns `{ inbox: number, [category]: number }`), getLibraryStats

6. **Create file service** (`src/main/services/file-service.ts`)
   - `ingestFile(sourcePath, libraryPath)`: **temp + hash + rename strategy**:
     1. Create `objects/.tmp/` dir if needed
     2. Stream source to temp file (`objects/.tmp/<uuid>.<ext>`) while piping through `crypto.createHash('sha256')` — single read pass
     3. After stream ends, check DB for existing hash via `getDocumentByHash(hash)`
     4. If duplicate: delete temp file, return `{ status: 'duplicate', existingId }`
     5. If new: `fs.rename` temp to `objects/<uuid>.<ext>`, return `{ storedPath, contentHash, sizeBytes, mimeType }`
   - MIME detection: extension-first (reliable for .pdf, .png, .jpg, .txt, .docx), with a basic magic-bytes fallback for ambiguous cases
   - `deleteStoredFile(libraryPath, storedPath)`
   - `exportFile(libraryPath, storedPath, destinationPath)` — copy out
   - `getAbsolutePath(libraryPath, storedPath)`
   - **Path validation helper**: resolve symlinks, verify path stays within library root

7. **Create library manager** (`src/main/lib/library-manager.ts`)
   - `initializeLibrary(path)` — mkdir `objects/`, `logs/`
   - `validateLibrary(path)` — check db.sqlite exists, objects/ is dir
   - `getDefaultLibraryPath()` — `path.join(app.getPath('documents'), 'FileHarbor')`

8. **Create settings module** (`src/main/lib/settings.ts`)
   - Read/write JSON at `path.join(app.getPath('userData'), 'settings.json')`
   - Fields: `libraryPath`, `watchedFolderPath`, `windowBounds`

9. **Create logger** (`src/main/lib/logger.ts`)
   - Scoped loggers via electron-log: `mainLog`, `ipcLog`, `dbLog`
   - File logging to library's `logs/` directory

10. **Create PDF text extraction worker** (`src/main/services/pdf-extractor.ts` + `src/main/services/pdf-worker.ts`)
    - `pdf-worker.ts`: Node `worker_threads` Worker script
      - Receives file path via `parentPort.on('message')`
      - Reads file buffer, calls `unpdf.extractText(buffer)`, caps at 100K chars
      - Posts result back: `{ filePath, text }` or `{ filePath, error }`
    - `pdf-extractor.ts`: manages the worker
      - `queueExtraction(filePath, documentId)` — posts job to worker
      - Worker returns text -> extractor updates DB record with `extracted_text`
      - Handles errors gracefully (corrupted/scanned PDFs get null extracted_text)
      - Skips files > 50MB (log warning)
    - Worker keeps the main process responsive during large batch imports

11. **Create IPC channels constant** (`src/main/ipc-channels.ts`)
    - Typed object: `IPC_CHANNELS = { LIBRARY_CHOOSE_PATH: 'library:choose-path', LIBRARY_INIT: 'library:initialize', ... }` — ~15-20 channels
    - Export for use in both ipc-handlers.ts and preload.ts

12. **Wire IPC handlers** (`src/main/ipc-handlers.ts`)
    - All handlers registered in one function called from main.ts
    - Library: choose-path (dialog.showOpenDialog), initialize, get-info, open-folder (shell.openPath)
    - Documents: ingest-files, get-by-category, update-category, delete, search, get-file-path, export (dialog.showSaveDialog), reveal-in-finder (shell.showItemInFolder), get-counts
    - Each handler wrapped in try/catch with structured error logging

13. **Expand preload** (`src/preload/preload.ts`)
    - Expose all channels via `contextBridge.exposeInMainWorld('electronAPI', { ... })`
    - Each method calls `ipcRenderer.invoke(IPC_CHANNELS.X, ...args)`
    - Event listeners (for watcher events) return cleanup functions

14. **Create renderer type declaration** (`src/renderer/electron.d.ts`)
    - `declare global { interface Window { electronAPI: { ... } } }`

15. **Update main.ts**
    - On `app.whenReady()`: load settings, register IPC handlers
    - If saved library path exists and validates, use it
    - Register custom protocol scheme before ready (for Phase 5)
    - Graceful shutdown: `app.on('before-quit')` — close DB, stop watcher

### Verify
- App starts. If no library configured, nothing crashes (UI still shows placeholder).
- DevTools: `await window.electronAPI.chooseLibraryPath()` opens folder dialog
- `await window.electronAPI.initializeLibrary(path)` creates folder structure + db.sqlite
- `await window.electronAPI.ingestFiles(['/path/to/test.pdf'])` copies file, creates record
- `await window.electronAPI.getDocumentsByCategory(null)` returns Inbox docs
- `await window.electronAPI.searchDocuments('test')` finds document
- Same file again: returns `{ status: 'duplicate' }`
- `await window.electronAPI.deleteDocument(id)` removes file + DB row
- Quit and reopen: library path remembered from settings

---

## Phase 3: UI Shell (Sidebar, Document List, Navigation)

**Goal:** Three-panel layout rendering real data from the database. Sidebar navigation with counts, document list with selection, welcome/onboarding screen.

### Tasks

1. **Set up shadcn/ui foundation**
   - `src/renderer/lib/utils.ts`: `cn()` helper (clsx + tailwind-merge)
   - Base components in `src/renderer/components/ui/`: button, input, scroll-area, badge, separator, dialog, alert-dialog
   - Configure shadcn for Tailwind v4 (CSS variables, no tailwind.config needed)

2. **Create zustand store** (`src/renderer/stores/app-store.ts`)
   - State: `libraryPath`, `currentView` ('inbox' | Category), `documents`, `selectedDocumentId`, `searchQuery`, `sidebarCounts`, `isLoading`
   - Actions: `setCurrentView(view)` — updates view + triggers loadDocuments, `loadDocuments()`, `refreshCounts()`, `setSelectedDocument(id)`
   - On view change: call appropriate IPC method, update documents array

3. **Create IPC wrapper** (`src/renderer/lib/ipc.ts`)
   - Typed thin wrapper so components never reference `window.electronAPI` directly
   - Centralizes error handling

4. **Build WelcomeScreen** (`src/renderer/components/onboarding/WelcomeScreen.tsx`)
   - Shown on first launch when no library configured
   - "Welcome to File Harbor" heading, brief description
   - "Choose Library Location" button with default suggestion path shown
   - On choose: calls IPC to pick folder, then initialize, then transition to main UI

5. **Build Sidebar** (`src/renderer/components/layout/Sidebar.tsx`)
   - Fixed width (~240px), full height, scrollable
   - "Inbox" item at top with count badge (highlighted if has docs)
   - Separator, then 12 category items each with lucide icon + count badge
   - Active view has distinct background highlight
   - Click navigates, loads documents for that view

6. **Build TopBar** (`src/renderer/components/layout/TopBar.tsx`)
   - "File Harbor" app title on left
   - Search input in center (debounced 300ms) — placeholder "Search documents..."
   - "Import" button + gear icon for settings on right
   - macOS: account for traffic light area with left padding

7. **Build DocumentList + DocumentRow**
   - `DocumentList.tsx`: scrollable list, loading skeleton, empty state per view
   - `DocumentRow.tsx`: file type icon (lucide: FileText for PDF, Image for images, File for others), original filename, added date (relative: "2 hours ago"), source badge, category badge (if filed)
   - Single click selects (highlight row), keyboard arrow keys navigate list

8. **Build MainContent** (`src/renderer/components/layout/MainContent.tsx`)
   - View title ("Inbox", "Taxes", etc.), document count, sort toggle (Date / Name)
   - Contains DocumentList

9. **Compose App.tsx**
   - State machine: 'loading' -> 'onboarding' (no library) | 'ready' (has library)
   - Loading: check settings for saved library path
   - Onboarding: render WelcomeScreen
   - Ready: flexbox layout — `Sidebar | (TopBar + MainContent)`
   - Default to Inbox view, load counts on mount

### Verify
- First launch: Welcome screen appears, can choose library, transitions to main UI
- Sidebar shows Inbox + 12 categories with correct counts
- Clicking sidebar items switches view, loads correct documents
- Document rows show correct info (filename, date, type icon)
- Empty states render per-view messages
- Window resizing: sidebar stays fixed, content area fills remaining space
- Sort toggle switches between date and name ordering

---

## Phase 4: Document Ingestion (Drag-Drop, File Picker, Watched Folder)

**Goal:** All three intake methods working. Duplicate detection UX. Real-time UI updates after ingestion.

### Tasks

1. **Build DropZone** (`src/renderer/components/inbox/DropZone.tsx`)
   - Full-app overlay triggered by `onDragEnter` on the window
   - Visual: semi-transparent backdrop with "Drop files to import" message + icon
   - On drop: extract file paths from `event.dataTransfer.files`, filter directories, call `ingestFiles()`
   - Show result via toast (sonner)
   - Dismiss on `onDragLeave` or `onDrop`

2. **Add "Import Files" button in TopBar**
   - Calls IPC `documents:open-file-picker` which triggers `dialog.showOpenDialog` with filters for accepted types + `multiSelections: true`
   - Returns selected paths, feeds through ingest pipeline

3. **Enhance batch ingest in IPC handler**
   - For each file: run through temp+hash+rename pipeline (stream to temp, hash, check for dupe, rename or delete temp)
   - Return array of `IngestResult` objects
   - After all files processed, queue text extraction for PDFs via worker thread
   - Send progress events via `webContents.send()` for large batches

4. **Build watcher service** (`src/main/services/watcher-service.ts`)
   - `chokidar.watch(folderPath, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 } })`
   - `awaitWriteFinish` is chokidar's built-in stability detection — fires event only after file size is stable for 2s. Handles downloads-in-progress automatically.
   - Listen for `add` events only
   - Filter by `ACCEPTED_EXTENSIONS`, ignore dotfiles, `.DS_Store`, `~$*` (Office temp), `.tmp`, `.crdownload`, `.part`
   - On new file: ingest via same pipeline, send `watcher:file-ingested` event to renderer with document info
   - `start(folderPath)`, `stop()`, `getWatchedFolder()` methods
   - Clean up watcher on app quit

5. **Add watcher IPC channels**
   - `watcher:set-folder`: open folder dialog, save to settings, start watching
   - `watcher:get-folder`: return current path or null
   - `watcher:clear-folder`: stop watching, remove from settings

6. **Build SettingsDialog** (`src/renderer/components/settings/SettingsDialog.tsx`)
   - Dialog/modal accessible from gear icon in TopBar
   - Library section: path display, "Open in Finder" button, stats (doc count, total size)
   - Watched folder section: current path or "Not configured", "Choose Folder" / "Clear" buttons
   - Close button

7. **Add toast notifications (sonner)**
   - Install sonner, add `<Toaster />` to App.tsx
   - After ingest: "3 documents imported" / "1 duplicate skipped" / "Error importing file.xyz"
   - After watcher ingest: "New file imported: invoice.pdf"

8. **Wire real-time UI updates**
   - After any successful ingest: refresh current view's document list + sidebar counts
   - Preload exposes `onFileIngested(callback)` which listens to `watcher:file-ingested` events and returns a cleanup function
   - App.tsx (or store) subscribes on mount, unsubscribes on unmount

9. **Handle duplicate detection UX**
   - Single file: toast notification "File already exists as [filename] in [category]"
   - Batch: toast summary "5 imported, 2 duplicates skipped"
   - For MVP: skip duplicates by default (simplest UX, per requirements "warn and skip")

### Verify
- Drag files onto app -> overlay -> files appear in Inbox -> toast confirmation
- Import button -> native file picker -> files in Inbox -> toast
- Configure watched folder in Settings -> copy file into folder -> appears in Inbox within ~3s -> toast
- Import same file twice -> toast says "duplicate skipped"
- Import 50+ files at once -> no UI freeze, toast shows final count
- Sidebar Inbox count updates after each ingestion
- Close and reopen Settings -> watched folder path remembered

---

## Phase 5: Filing, Preview, and Document Actions

**Goal:** Complete document lifecycle. File docs into categories via keyboard-first command palette. Preview PDFs/images in-app. Export, reveal, delete.

### Tasks

1. **Build CategoryPicker** (`src/renderer/components/filing/CategoryPicker.tsx`)
   - Built on `cmdk` (Command component)
   - Opens as a centered dialog/overlay
   - Shows searchable list of 12 categories with lucide icons
   - Type to filter instantly, arrow keys to navigate, Enter to select, Escape to close
   - On select: call `updateDocumentCategory(docId, category)`, refresh view + counts
   - Can be used from Inbox (initial filing) or from any view (re-categorize)

2. **Wire keyboard shortcuts** (`src/renderer/hooks/useKeyboardShortcuts.ts`)
   - Global `keydown` listener on `window`
   - Guard: skip if `activeElement` is input/textarea/contenteditable
   - `F` — open CategoryPicker for selected document
   - `Enter` — open preview for selected document
   - `Delete` / `Backspace` — prompt delete for selected document
   - `Cmd/Ctrl+I` — open file picker for import
   - Arrow Up/Down — navigate document list selection

3. **Add context menu to DocumentRow**
   - Right-click shows: "File to...", "Preview", "Export...", "Reveal in Finder", separator, "Delete"
   - Use Radix ContextMenu or a simple custom implementation

4. **Register custom protocol** (in `src/main/main.ts`, before `app.whenReady`)
   - `protocol.registerSchemesAsPrivileged([{ scheme: 'file-harbor', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])`
   - After ready: `protocol.handle('file-harbor', (request) => { ... validate path within library ... return net.fetch(pathToFileURL(resolved).toString()) })`
   - Security: resolve symlinks, verify path stays within library `objects/` directory

5. **Build DocumentPreview** (`src/renderer/components/documents/DocumentPreview.tsx`)
   - Opens as a right-side panel (or full overlay)
   - **PDF**: react-pdf `<Document>` + `<Page>` with page navigation (prev/next, page count)
     - Set `pdfjs.GlobalWorkerOptions.workerSrc` in the **same module** as `<Document>` (react-pdf 10.x requirement)
     - Worker loaded via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`
     - Load PDF via `file-harbor://objects/<uuid>.pdf` URL
   - **Images**: `<img src="file-harbor://objects/<uuid>.jpg" />`
   - **Unsupported formats** (.txt, .docx, etc.): file icon, metadata (name, size, type, date), "Open in Default App" button
   - Header: filename, category badge, date added
   - Action bar: "File to..." button, "Export" button, "Open Externally" button, "Reveal in Finder", "Delete"

6. **Add export**
   - "Export" button in preview and context menu
   - Calls IPC `documents:export` which opens `dialog.showSaveDialog` pre-filled with original filename
   - Copies stored file to chosen destination

7. **Add delete with confirmation**
   - "Delete" triggers shadcn AlertDialog: "Delete [filename]? This permanently removes it from your library."
   - On confirm: IPC `documents:delete` removes DB record + stored file
   - Refreshes current view + sidebar counts
   - Toast: "Document deleted"

8. **Add sort controls**
   - Toggle between "Date added (newest)" and "Name (A-Z)"
   - Client-side sort on the loaded documents array
   - Persist preference in zustand store (not settings — ephemeral)

### Verify
- Select doc in Inbox -> press `F` -> CategoryPicker opens -> type "Tax" -> Enter -> doc moves to Taxes, disappears from Inbox
- Click "Taxes" in sidebar -> doc appears there
- Select a PDF -> press Enter -> preview renders with readable pages, page navigation works
- Select an image -> preview shows correctly via custom protocol
- Select a .docx -> shows metadata + "Open in Default App" opens it in Word/Pages
- Right-click doc -> context menu -> all actions work
- "Export" -> save dialog with original filename -> file saved
- "Delete" -> confirmation -> doc removed from list, file removed from disk
- All keyboard shortcuts work, don't fire when typing in search input

---

## Phase 6: Search, Polish, and Edge Cases

**Goal:** Full-text search, background text extraction, graceful error handling, loading states, window persistence, app menu.

### Tasks

1. **Implement search UI**
   - Search input in TopBar (already placed in Phase 3)
   - Debounced (300ms) — when query is non-empty, call `searchDocuments(query)` and show results in main content as a "Search Results" view
   - Clear search (Escape or clear button) returns to previous category/inbox view
   - Search is global across all categories

2. **Implement database search**
   - LIKE queries: `WHERE original_filename LIKE '%query%' OR extracted_text LIKE '%query%'`
   - Sufficient for MVP (per requirements: "instant for filename, acceptable for text search on a few thousand docs")
   - Keep `searchDocuments()` as a clean abstraction in the database service — renderer only calls this method, making a future FTS5 upgrade a single-file change

3. **Background PDF text extraction** (already implemented in Phase 2 via worker thread)
   - Verify worker thread pipeline works end-to-end: ingest PDF -> worker extracts text -> DB updated -> search finds it
   - Verify main process stays responsive during extraction of large/many PDFs
   - Verify extraction errors are logged and don't crash the worker

4. **Graceful shutdown** (pattern from craft-agents-oss)
   - `app.on('before-quit')`: close database connection, stop file watcher, flush any pending writes

5. **Edge case handling**
   - Library folder deleted externally: on startup `validateLibrary()`, if invalid show WelcomeScreen to choose new location
   - Watched folder disappears: watcher error handler logs it, notifies user via toast, clears the watched folder setting
   - Corrupt database: try/catch on DB init, offer to create fresh database (files in `objects/` remain intact)

6. **Loading and empty states**
   - Loading skeleton while fetching documents
   - Empty states with helpful messages:
     - Inbox empty: "All caught up! Drag files here or import to get started."
     - Category empty: "No documents filed under [Category]."
     - Search no results: "No documents match '[query]'."

7. **Window state persistence**
   - On window `close`/`resize`/`move`: save bounds to settings
   - On startup: restore window position and size from settings
   - Also remember last-viewed category

8. **Application menu** (`src/main/menu.ts` or inline in main.ts)
   - macOS: File Harbor (About, Quit), File (Import Files: Cmd+I, Open Library Folder), Edit (standard Undo/Redo/Cut/Copy/Paste), Window (Minimize, Zoom), Help
   - Map menu items to existing IPC handlers

9. **Error handling pass**
   - All IPC handlers: try/catch with `ipcLog.error()`, return structured errors
   - Renderer: show toast for user-facing errors
   - Main process: catch uncaughtException and unhandledRejection, log them

10. **Performance sanity check**
    - Verify streaming hash works for large files (no full-file memory read)
    - Verify document list with 200+ items scrolls smoothly
    - Verify watcher doesn't leak memory on long runs
    - Verify DB queries return quickly with indexes

### Verify
- Type "invoice" in search -> docs with filename or extracted text match appear
- Import a PDF -> wait a few seconds -> search for a word from inside the PDF -> found
- 500 documents in library -> app loads under 2s, scrolling smooth
- Close and reopen -> window size/position and library path remembered, opens to last-viewed category
- Quit app gracefully (Cmd+Q) -> no data loss, no zombie processes
- All empty states display correctly
- Keyboard shortcuts all work, app menu items functional
- Watched folder configured -> delete the folder externally -> app handles gracefully with notification
