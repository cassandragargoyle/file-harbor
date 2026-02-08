# Multi-Workspace Support for File Harbor

## Context

File Harbor currently forces users to select a single folder as their "library." We want to support multiple workspaces so users can have separate libraries (e.g., Personal, Work, Side Business). Each workspace is an independent library folder with its own `db.sqlite`, `objects/`, and watched folder. Users start with a "Default" workspace, and can optionally add more. One workspace is active at a time.

---

## 1. Add `Workspace` type

**File:** `src/shared/types.ts`

```ts
export interface Workspace {
  id: string;           // UUID
  name: string;         // Display name, e.g. "Default"
  libraryPath: string;  // Absolute path to library folder
  watchedFolderPath?: string;  // Per-workspace watched folder
}
```

---

## 2. Migrate settings schema

**File:** `src/main/lib/settings.ts`

**New `AppSettings` shape:**
```ts
interface AppSettings {
  version: 2;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  windowBounds?: { x: number; y: number; width: number; height: number };
  lastView?: string;
}
```

**Changes:**
- Add `LegacySettings` type for the old v1 shape (`libraryPath`, `watchedFolderPath`, etc.)
- Add `migrateV1ToV2(legacy)`: wraps existing `libraryPath` + `watchedFolderPath` into a "Default" workspace
- Update `loadSettings()`: if loaded JSON lacks `version: 2`, run migration and persist. Fresh installs return `{ version: 2, workspaces: [], activeWorkspaceId: '' }`
- Keep `saveSettings()` and `updateSettings()` working with the new shape
- Add helpers: `getActiveWorkspace(settings)` and `updateWorkspace(workspaceId, partial)`

---

## 3. Main process changes

**File:** `src/main/main.ts`

- Add `activeWorkspaceId: string | null` to `appState`
- Change `initializeLibraryServices(libraryPath: string)` to `initializeLibraryServices(workspace: Workspace)` — reads `watchedFolderPath` from workspace instead of global settings, sets `appState.activeWorkspaceId`
- Update watcher error callback: call `updateWorkspace(workspace.id, ...)` instead of `updateSettings(...)`
- Extract `teardownLibraryServices()` from the `before-quit` handler (stops watcher, shuts down PDF extractor, closes DB, nulls all state)
- Add `switchWorkspace(workspaceId)`: validates path, teardown, reinit, save active ID, reset lastView to inbox
- Update `app.on('ready')`: use `getActiveWorkspace(settings)` instead of `settings.libraryPath`
- Update `app.on('before-quit')`: call `teardownLibraryServices()`
- Pass callbacks object to `registerIpcHandlers` instead of single function:
  ```ts
  registerIpcHandlers(appState, {
    initializeServices: initializeLibraryServices,
    teardownServices: teardownLibraryServices,
    switchWorkspace,
  })
  ```

---

## 4. New IPC channels

**File:** `src/main/ipc-channels.ts`

Add 7 channels:
```
WORKSPACE_LIST:       'workspace:list'
WORKSPACE_ADD:        'workspace:add'
WORKSPACE_RENAME:     'workspace:rename'
WORKSPACE_REMOVE:     'workspace:remove'
WORKSPACE_SWITCH:     'workspace:switch'
WORKSPACE_GET_ACTIVE: 'workspace:get-active'
WORKSPACE_SWITCHED:   'workspace:switched'   // main->renderer event
```

---

## 5. IPC handler changes

**File:** `src/main/ipc-handlers.ts`

- Update `AppState` to add `activeWorkspaceId: string | null`
- Change second param from `onLibraryInitialized: (path: string) => void` to `LibraryCallbacks` object with `initializeServices`, `teardownServices`, `switchWorkspace`
- **Update `LIBRARY_INITIALIZE`:** create a "Default" workspace, add to settings, set active, call `callbacks.initializeServices(workspace)`
- **Update `WATCHER_SET_FOLDER`:** call `updateWorkspace(state.activeWorkspaceId, { watchedFolderPath })` instead of `updateSettings({ watchedFolderPath })`
- **Update `WATCHER_CLEAR_FOLDER`:** same — `updateWorkspace` instead of `updateSettings`
- **Add new handlers:**
  - `WORKSPACE_LIST` — return `loadSettings().workspaces`
  - `WORKSPACE_GET_ACTIVE` — return `state.activeWorkspaceId`
  - `WORKSPACE_ADD(name, libraryPath)` — create library dir, create workspace, append to settings, switch to it
  - `WORKSPACE_RENAME(id, name)` — call `updateWorkspace(id, { name })`
  - `WORKSPACE_REMOVE(id)` — refuse if last workspace; remove from settings; if active, switch to first remaining
  - `WORKSPACE_SWITCH(id)` — call `callbacks.switchWorkspace(id)`

---

## 6. Preload bridge

**File:** `src/preload/preload.ts`

- Add 7 workspace channel strings to the `IPC` const
- Add 7 methods to `electronAPI`:
  - `listWorkspaces()`, `addWorkspace(name, path)`, `renameWorkspace(id, name)`, `removeWorkspace(id)`, `switchWorkspace(id)`, `getActiveWorkspaceId()`
  - `onWorkspaceSwitched(callback)` — event listener with cleanup return

---

## 7. Type declarations

**File:** `src/renderer/electron.d.ts`

- Import `Workspace` type
- Add 7 new method signatures to `ElectronAPI`
- Update `getSettings` return type to include `version`, `workspaces: Workspace[]`, `activeWorkspaceId`

---

## 8. Renderer IPC wrapper

**File:** `src/renderer/lib/ipc.ts`

Add typed wrappers for all 7 workspace operations.

---

## 9. Zustand store changes

**File:** `src/renderer/stores/app-store.ts`

**New state:** `workspaces`, `activeWorkspaceId`, `activeWorkspaceName`

**New actions:**
- `switchWorkspace(id)` — IPC call, refresh workspace list, reset view/docs/search, reload
- `addWorkspace(name, path)` — IPC call, same refresh pattern
- `renameWorkspace(id, name)` — IPC call, refresh list
- `removeWorkspace(id)` — IPC call, re-fetch active workspace, reload

**Updated `initialize()`:** check `settings.workspaces?.length > 0` instead of `settings.libraryPath`

---

## 10. UI changes

### WorkspaceSwitcher (new)
**File:** `src/renderer/components/layout/WorkspaceSwitcher.tsx`

Dropdown button in sidebar showing active workspace name + chevron. Popover lists all workspaces (checkmark on active), "Add Workspace...", and "Manage Workspaces...".

### WorkspaceManagerDialog (new)
**File:** `src/renderer/components/layout/WorkspaceManagerDialog.tsx`

Modal dialog (same style as SettingsDialog) listing workspaces with inline rename and remove. Remove disabled when only 1 workspace remains.

### Sidebar
**File:** `src/renderer/components/layout/Sidebar.tsx`

Render `<WorkspaceSwitcher />` between drag region and nav.

### App.tsx
**File:** `src/renderer/App.tsx`

WelcomeScreen's `onComplete` re-runs `initialize()` so workspace state is populated. Add `onWorkspaceSwitched` event listener in ready-phase effect.

### SettingsDialog
**File:** `src/renderer/components/settings/SettingsDialog.tsx`

Show active workspace name in Library section.

---

## Implementation order

1. **Data model + migration** — `types.ts`, `settings.ts`
2. **Main process** — `main.ts`
3. **IPC layer** — `ipc-channels.ts`, `ipc-handlers.ts`, `preload.ts`, `electron.d.ts`, `ipc.ts`
4. **Store** — `app-store.ts`
5. **UI** — `WorkspaceSwitcher.tsx`, `WorkspaceManagerDialog.tsx`, `Sidebar.tsx`, `App.tsx`, `SettingsDialog.tsx`

---

## Files (12 modified, 2 new)

| File | Type |
|------|------|
| `src/shared/types.ts` | modify |
| `src/main/lib/settings.ts` | modify |
| `src/main/main.ts` | modify |
| `src/main/ipc-channels.ts` | modify |
| `src/main/ipc-handlers.ts` | modify |
| `src/preload/preload.ts` | modify |
| `src/renderer/electron.d.ts` | modify |
| `src/renderer/lib/ipc.ts` | modify |
| `src/renderer/stores/app-store.ts` | modify |
| `src/renderer/App.tsx` | modify |
| `src/renderer/components/layout/Sidebar.tsx` | modify |
| `src/renderer/components/settings/SettingsDialog.tsx` | modify |
| `src/renderer/components/layout/WorkspaceSwitcher.tsx` | **new** |
| `src/renderer/components/layout/WorkspaceManagerDialog.tsx` | **new** |

No changes needed to: database service, file service, watcher service, PDF extractor, library-manager, schema, constants, menu.

---

## Verification

1. **Fresh install:** WelcomeScreen -> pick folder -> "Default" workspace created -> switcher shows "Default"
2. **Migration:** Existing v1 `settings.json` auto-migrates to v2 with "Default" workspace wrapping existing libraryPath/watchedFolderPath
3. **Add workspace:** Switcher -> "Add Workspace" -> pick folder -> enter name -> switches to new empty workspace
4. **Switch:** Click different workspace -> teardown + reinit -> correct documents load
5. **Rename/Remove:** Via Manage Workspaces dialog
6. **Watched folder:** Independent per workspace — switching restores correct watcher
7. **Typecheck:** Run `npm run typecheck` after all changes
