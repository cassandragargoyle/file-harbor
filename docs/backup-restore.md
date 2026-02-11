# Workspace Backup & Restore

## Overview

Allow users to create a complete backup of their current workspace that can be restored later — either on the same machine or a different one. Unlike the "Export All Files" feature (which produces a clean folder of human-readable files), a backup preserves the full internal state: database, metadata, categories, suggestions, settings — everything needed to reconstruct the workspace exactly as it was.

## Why Both Export and Backup?

These serve different purposes:

| | Export | Backup |
|---|---|---|
| **Goal** | "Give me my files in a normal folder" | "Save a snapshot I can restore from" |
| **Audience** | End user browsing files | The app itself (restore operation) |
| **Format** | Folder of named files + optional manifest | Single archive file (`.fhbackup` or `.zip`) |
| **Includes DB** | No | Yes |
| **Includes settings** | No | Yes (workspace-level) |
| **Preserves UUIDs** | No | Yes |
| **Preserves categories** | As folder structure only | Fully, in database |
| **Preserves suggestions** | No | Yes |
| **Preserves content hashes** | In manifest only | Yes, in database |
| **Restorable by app** | Partially (could re-import from manifest) | Fully — exact reconstruction |

## What Goes Into a Backup

A backup archive should contain everything under the workspace's `libraryPath`:

```
workspace-backup-2026-02-11.fhbackup
├── db.sqlite                          # Full database (all metadata, categories, suggestions, hashes)
├── objects/                           # All stored files, UUID-named
│   ├── a1b2c3d4-...-e5f6.pdf
│   ├── f7g8h9i0-...-j1k2.png
│   └── ...
└── backup-meta.json                   # Backup metadata
```

### backup-meta.json

```json
{
  "version": 1,
  "createdAt": "2026-02-11T14:30:00Z",
  "appVersion": "1.0.0",
  "workspaceName": "Personal Documents",
  "documentCount": 47,
  "totalSizeBytes": 523000000,
  "platform": "darwin",
  "checksum": "sha256:..."
}
```

The `version` field allows the restore process to handle format changes over time. The `checksum` covers the entire archive contents for integrity verification.

### What Does NOT Go Into a Backup

- **App-level settings** (window bounds, active workspace ID, other workspace definitions) — these are in the global `settings.json` and are machine-specific
- **Watched folder path** — this is a machine-specific absolute path; the user would need to re-configure it after restore
- **Log files** — not useful to restore
- **Temp files** (`objects/.tmp/`) — incomplete ingestions; discard

## Backup Format

### Option A: Custom `.fhbackup` Extension (Recommended)

Actually a zip file under the hood, but with a custom extension. Benefits:
- Double-clicking opens File Harbor (register file association) rather than the OS zip handler
- Clear that this is "a File Harbor backup" not just a random zip
- Can be renamed to `.zip` and inspected manually if needed
- The app can validate the magic bytes / internal structure before attempting restore

### Option B: Plain `.zip`

Simpler, more transparent. Users know what a zip is. Downside: no file association, and users might unzip it manually and get confused by UUID filenames.

### Option C: Directory-based (no compression)

Just copy the `libraryPath` folder. Fastest to create, but large and not portable. Fine as an internal "snapshot" but not great for sharing across machines or cloud storage.

Recommendation: **Option A** — zip with `.fhbackup` extension. Best balance of portability, clarity, and app integration.

## Backup Flow (UX)

1. **Entry point**: File menu → "Back Up Workspace..." or Settings → Backup section
2. **Save dialog**: OS save dialog, default filename `file-harbor-backup-{workspace-name}-{date}.fhbackup`
3. **Progress**: "Backing up workspace... (47 documents, ~500 MB)" with a progress bar. For large workspaces this could take 30+ seconds.
4. **Completion**: Toast — "Backup saved to ~/Desktop/file-harbor-backup-Personal-2026-02-11.fhbackup" with "Reveal in Finder" action

### Implementation Notes

```
1. Flush SQLite WAL (PRAGMA wal_checkpoint(TRUNCATE)) to ensure db.sqlite is complete
2. Create a temporary zip stream
3. Add db.sqlite to the archive
4. Walk objects/ directory, add each file to the archive
5. Generate backup-meta.json, add to archive
6. Compute checksum of the archive contents
7. Write final .fhbackup file to user-selected destination
8. Report completion
```

Key detail: the SQLite WAL checkpoint is critical. SQLite in WAL mode may have uncommitted data in the `-wal` file. Running `PRAGMA wal_checkpoint(TRUNCATE)` flushes everything to the main database file so we only need to back up `db.sqlite` itself.

## Restore Flow (UX)

Two entry points for restore:

### A. From the Welcome Screen (no workspace open)

The onboarding / workspace creation flow could offer: "Restore from Backup" alongside "Create New Workspace" and "Open Existing Library." This is the most natural place for it — the user is setting up the app on a new machine or starting fresh.

### B. From the File Menu (workspace already open)

File → "Restore Workspace from Backup..." — this would **replace** the current workspace's contents. Because this is destructive (overwrites the current library), it needs a strong confirmation dialog:

> **Restore from backup?**
>
> This will replace all documents and settings in "Personal Documents" with the contents of the backup. This action cannot be undone.
>
> Your current workspace has 47 documents. The backup contains 42 documents.
>
> [Cancel] [Restore]

### C. Create New Workspace from Backup

A third, less destructive option: the restore creates a **new workspace** rather than overwriting the current one. The user picks a location for the new library, and the backup is extracted there. The new workspace is added to their workspace list. This is probably the safest default.

### Restore Process

```
1. User selects .fhbackup file
2. Validate archive:
   a. Check it's a valid zip
   b. Check backup-meta.json exists and is parseable
   c. Verify version compatibility
   d. Optionally verify checksum
3. Show confirmation dialog with backup details (date, document count, size)
4. User chooses: restore into current workspace OR create new workspace
   - If new workspace: show folder picker for library location
   - If current workspace: show destructive action confirmation
5. Extract archive:
   a. If replacing: wipe existing objects/ and db.sqlite (after confirmation)
   b. Extract db.sqlite to library path
   c. Extract objects/ to library path
   d. Skip backup-meta.json (not needed at runtime)
6. Run any necessary database migrations (backup may be from older app version)
7. Re-initialize services (DatabaseService, etc.) against the restored library
8. Reload document list in the renderer
9. Toast: "Workspace restored from backup (42 documents)"
```

### Database Migration on Restore

This is important: a backup from an older version of the app may have an older database schema. The restore process should run the same migration pipeline that runs on normal app startup. Drizzle's migration system handles this — as long as we apply migrations after extracting the database, it will bring the schema up to date.

A backup from a **newer** version of the app is trickier. The restore should detect this (compare `appVersion` in backup-meta.json to the running app version) and warn the user: "This backup was created with a newer version of File Harbor. Some data may not be compatible." Depending on the schema change, it might work fine, or it might not — safer to warn and let the user decide.

## Automatic / Scheduled Backups (Future)

For v1, manual backup is sufficient. Future enhancements:

- **Auto-backup on a schedule**: daily/weekly, keep last N backups, configurable destination
- **Auto-backup before destructive operations**: before a restore, before deleting all documents in a category, etc.
- **Incremental backups**: only back up files changed since the last backup. Would need a backup manifest tracking what's already backed up. Significantly more complex but much faster for large libraries.
- **Cloud backup destination**: back up to iCloud Drive, Google Drive, Dropbox, etc. Just means writing the `.fhbackup` file to a cloud-synced folder.

## Edge Cases

- **Corrupt archive**: Zip extraction fails mid-way. If restoring into an existing workspace, this could leave things in a broken state. Mitigation: extract to a temporary directory first, then swap into place atomically (rename old library to `.bak`, rename temp to library path, delete `.bak` on success).
- **Disk space**: Large backups need roughly 2x the library size during creation (original + archive) and during restore (archive + extracted). Warn if destination has less than estimated required space.
- **File permissions**: Extracted files should inherit normal permissions. On macOS, files from a zip may lose extended attributes.
- **Cross-platform restore**: A backup created on macOS restored on Windows (or vice versa). File paths in `stored_path` use forward slashes (`objects/uuid.pdf`) which work on both platforms. The `source_path` field contains the original absolute path (e.g., `/Users/alice/Downloads/scan.pdf`) which won't be valid on another machine — that's fine, it's just metadata for provenance tracking.
- **Watched folder path**: Not restored (machine-specific). User must re-configure.
- **Backup during active ingestion**: Files in `objects/.tmp/` are incomplete. Exclude the `.tmp` directory from backups. Any documents mid-ingestion won't have DB records yet, so they'll be cleanly absent from both the database and the backup.
- **Very large workspaces**: Multi-GB libraries. The zip compression helps for text-heavy content (PDFs) but not for images. Progress reporting is essential. Consider streaming zip creation rather than buffering in memory.

## Open Questions

- Should backup include Ollama/LLM settings (model name, confidence thresholds)? These are workspace-level preferences stored in the global settings file. Leaning yes — include them in `backup-meta.json` so restore can re-apply them.
- Should we support partial restore? ("Only restore documents in the Taxes category.") Probably overkill for v1.
- What happens if the user tries to restore a backup into a workspace that has newer documents not in the backup? Should we offer a merge? Almost certainly not for v1 — full replace is simpler and more predictable. Merge is a rabbit hole.
- File association: should `.fhbackup` files be registered with the OS so double-clicking one opens File Harbor and starts the restore flow? Nice UX but adds platform-specific registration complexity.
