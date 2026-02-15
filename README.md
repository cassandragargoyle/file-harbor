# File Harbor

A personal document filing cabinet for your desktop. File Harbor is a local-first Electron app that lets you import, organize, search, and preview documents without relying on cloud services. Your files and metadata stay on your machine in a portable library folder.

## Overview

File Harbor works like a digital filing cabinet. When you first launch the app you choose a library folder on disk — this becomes your first **workspace**. You can create additional workspaces to keep different areas of your life separate (e.g. Personal, Work, Side Business). From any workspace you can import documents by dragging them onto the window, using the file picker, importing an entire folder, or pointing the app at a watched folder for automatic import. Every document lands in your **Inbox** where you can preview it and file it into one of 14 built-in categories:

**Identity** | **Taxes** | **Banking** | **Insurance** | **Medical** | **Home** | **Work** | **Kids** | **Family** | **Receipts** | **Legal** | **Utilities** | **Mail** | **Other**

PDF text is automatically extracted in the background, making your documents searchable by content — not just filename. File Harbor can also suggest categories and filenames for new documents using keyword matching or an optional local LLM via Ollama.

### Key Features

- **Drag-and-drop import** — drop files onto the window to add them
- **Folder import** — import an entire directory (including subdirectories) via the menu or keyboard shortcut (`Cmd/Ctrl+Shift+I`)
- **Watched folder** — designate a folder for automatic import (e.g. a Downloads subfolder)
- **Duplicate detection** — SHA-256 content hashing prevents the same file from being stored twice
- **Full-text search** — search across filenames and extracted PDF text
- **In-app preview** — view PDFs, images, and text files without leaving the app
- **Document renaming** — rename documents directly from the context menu
- **Smart suggestions** — automatic category and filename suggestions powered by keyword matching on extracted text
- **Ollama LLM integration** — optionally connect a local Ollama instance for AI-powered category and filename suggestions
- **Multi-select** — Cmd/Ctrl-click to toggle, Shift-click to range-select, Cmd/Ctrl-A to select all; bulk file, export, or delete in one action
- **Batch filing** — review and accept or dismiss suggestions for multiple documents at once
- **Export and reveal** — export individual documents or reveal them in Finder/Explorer
- **Bulk export** — export your entire library organized into category folders with an export manifest
- **Backup and restore** — back up a workspace (database + files) to a folder, and restore from a previous backup
- **Category filing** — organize documents into 14 practical life categories
- **Multiple workspaces** — keep separate libraries for personal, work, and other contexts; switch between them from the sidebar
- **Local-first** — no accounts, no cloud sync, no telemetry; your data stays on your machine

### Supported File Types

| Extension        | MIME Type                                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| `.pdf`           | `application/pdf`                                                         |
| `.png`           | `image/png`                                                               |
| `.jpg` / `.jpeg` | `image/jpeg`                                                              |
| `.gif`           | `image/gif`                                                               |
| `.webp`          | `image/webp`                                                              |
| `.txt`           | `text/plain`                                                              |
| `.md`            | `text/markdown`                                                           |
| `.docx`          | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

## Downloads

Pre-built installers are available from the [latest release](https://github.com/adamgoth/file-harbor/releases/latest):

| Platform    | File                               | Notes                                                                    |
| ----------- | ---------------------------------- | ------------------------------------------------------------------------ |
| **macOS**   | `File.Harbor-x.x.x-darwin-x64.zip` | Extract the ZIP and move **File Harbor.app** to your Applications folder |
| **Windows** | `File.Harbor-x.x.x.Setup.exe`      | Run the installer — the app auto-launches when finished                  |

> Releases are created as drafts. Check the [Releases page](https://github.com/adamgoth/file-harbor/releases) for all available versions.

## Getting Started (Development)

### Prerequisites

- Node.js (v18+)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

This launches the app in development mode with hot-reload via Vite.

### Build

```bash
npm run package   # Package for current platform
npm run make      # Create distributable installers
```

### Creating a Release

First, copy the release workflow into your repository:

```bash
mkdir -p .github/workflows
cp docs/release-workflow.yml .github/workflows/release.yml
git add .github/workflows/release.yml
git commit -m "Add release workflow"
git push
```

Then tag and push to trigger a build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The GitHub Actions workflow builds installers for macOS and Windows and creates a draft release with the artifacts attached. Review and publish the draft from the [Releases page](https://github.com/adamgoth/file-harbor/releases).

## Tech Stack

| Layer           | Technology                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Framework       | [Electron](https://www.electronjs.org/) (v35) with Electron Forge                              |
| Bundler         | [Vite](https://vitejs.dev/) via `@electron-forge/plugin-vite`                                  |
| Language        | TypeScript throughout (main, preload, renderer, shared)                                        |
| UI              | [React 19](https://react.dev/) with [Tailwind CSS v4](https://tailwindcss.com/)                |
| State           | [Zustand](https://zustand-demo.pmnd.rs/)                                                       |
| Database        | [SQLite](https://sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| ORM             | [Drizzle ORM](https://orm.drizzle.team/)                                                       |
| File watcher    | [chokidar](https://github.com/paulmillr/chokidar)                                              |
| PDF extraction  | [unpdf](https://github.com/unjs/unpdf) in a Worker thread                                      |
| Icons           | [Lucide React](https://lucide.dev/)                                                            |
| Toasts          | [Sonner](https://sonner.emilkowal.dev/)                                                        |
| Command palette | [cmdk](https://cmdk.paco.me/)                                                                  |
| Logging         | [electron-log](https://github.com/megahertz/electron-log)                                      |

### Project Structure

```
src/
├── main/                    # Electron main process
│   ├── main.ts              # App entry, window creation, protocol, lifecycle
│   ├── menu.ts              # Application menu (File, Edit, Window)
│   ├── ipc-channels.ts      # IPC channel name constants
│   ├── ipc-handlers.ts      # All IPC handler registrations
│   ├── lib/
│   │   ├── library-manager.ts   # Library init & validation
│   │   ├── settings.ts          # Persistent settings (JSON)
│   │   └── logger.ts            # Structured logging
│   └── services/
│       ├── database.ts          # SQLite/Drizzle database service
│       ├── file-service.ts      # File ingestion, export, bulk export, deletion
│       ├── pdf-extractor.ts     # PDF text extraction queue
│       ├── pdf-worker.ts        # Worker thread for PDF parsing
│       ├── watcher-service.ts   # Watched folder auto-import
│       ├── backup-service.ts    # Workspace backup & restore
│       ├── keyword-matcher.ts   # Rule-based category suggestion engine
│       ├── filename-suggester.ts # Filename suggestion from extracted text
│       ├── llm-suggester.ts     # LLM-powered suggestions via Ollama
│       └── ollama-service.ts    # Ollama HTTP client
├── preload/                 # Context bridge (preload script)
├── renderer/                # React UI
│   ├── components/
│   │   ├── onboarding/      # Welcome screen & library setup
│   │   ├── layout/          # Sidebar, TopBar, MainContent, WorkspaceSwitcher
│   │   ├── inbox/           # DropZone overlay, BatchFileDialog
│   │   ├── documents/       # DocumentList, DocumentRow, Preview, ContextMenu, RenameDialog
│   │   ├── filing/          # CategoryPicker
│   │   └── settings/        # SettingsDialog, OllamaSettings
│   ├── stores/              # Zustand state
│   └── lib/                 # IPC wrappers, utilities
└── shared/                  # Code shared between main & renderer
    ├── types.ts             # TypeScript interfaces
    ├── constants.ts         # Categories, accepted types, limits
    └── schema.ts            # Drizzle table schema
```

### Architecture

The app follows Electron's process model with strict context isolation:

- **Main process** — manages the library on disk, runs the database, handles file I/O, and coordinates background services (watcher, PDF extraction). All privileged operations live here.
- **Preload script** — exposes a typed IPC bridge to the renderer via `contextBridge`. The renderer never has direct access to Node.js APIs.
- **Renderer process** — a React SPA that communicates with the main process exclusively through IPC calls. State is managed with Zustand.
- **Shared module** — TypeScript types, the Drizzle schema, and constants are shared across processes to keep the contract in sync.

### Security

- `contextIsolation: true` and `nodeIntegration: false` — renderer has no direct Node access
- Custom `file-harbor://` protocol restricts access to the `objects/` directory only
- Path validation resolves symlinks before any file operation to prevent directory traversal
- Electron Fuses are enabled: `RunAsNode` disabled, cookie encryption on, ASAR integrity validation on, Node CLI inspect arguments disabled

## Document Storage

This section describes how documents are represented on disk and in the database once they've been added to File Harbor.

### Library Directory

When you choose a library location, File Harbor creates the following structure:

```
~/Documents/FileHarbor/          # or wherever you point it
├── db.sqlite                    # SQLite database (WAL mode)
├── objects/                     # All stored documents
│   ├── 550e8400-e29b-....pdf
│   ├── 7c6ec29a-a1d4-....jpg
│   ├── d5ecacb1-f03e-....docx
│   └── .tmp/                    # Staging area during ingestion
└── logs/                        # Application logs
```

Documents are stored **flat** inside `objects/` — there are no subdirectories. Each file is renamed from its original filename to `{uuid}.{extension}` (e.g. `550e8400-e29b-41d4-a716-446655440000.pdf`). Organization is logical via database categories, not the filesystem hierarchy.

The library folder is fully portable. You can move it to another drive or machine and point File Harbor at the new location.

### Database Schema

All metadata lives in a single `documents` table inside `db.sqlite`:

```sql
CREATE TABLE documents (
  id                      TEXT PRIMARY KEY,        -- UUID v4
  original_filename       TEXT NOT NULL,           -- Name as the user sees it
  stored_path             TEXT NOT NULL,           -- Relative path: objects/{uuid}.ext
  mime_type               TEXT NOT NULL,           -- e.g. application/pdf
  size_bytes              INTEGER NOT NULL,        -- File size
  added_at                TEXT NOT NULL,           -- ISO 8601 timestamp
  source                  TEXT NOT NULL,           -- 'dragdrop' | 'file_picker' | 'watched_folder'
  source_path             TEXT,                    -- Original file path before import
  category                TEXT,                    -- Category name, or NULL for Inbox
  content_hash            TEXT NOT NULL,           -- SHA-256 hex digest
  extracted_text          TEXT,                    -- Full text from PDFs (max 100k chars)
  suggested_category      TEXT,                    -- Auto-suggested category
  suggestion_confidence   REAL,                    -- Confidence score 0.0–1.0
  suggestion_source       TEXT,                    -- 'keywords' | 'ollama'
  suggested_filename      TEXT,                    -- Auto-suggested descriptive filename
  suggestion_outcome      TEXT,                    -- 'accepted' | 'dismissed', or NULL if pending
  updated_at              TEXT NOT NULL            -- ISO 8601 timestamp
);
```

Three indexes support fast queries:

| Index                        | Column         | Purpose                               |
| ---------------------------- | -------------- | ------------------------------------- |
| `idx_documents_category`     | `category`     | Sidebar category counts and filtering |
| `idx_documents_content_hash` | `content_hash` | Duplicate detection on import         |
| `idx_documents_added_at`     | `added_at`     | Recent-first ordering                 |

The database runs in **WAL mode** (Write-Ahead Logging) for safe concurrent reads during background PDF extraction.

### File Ingestion Pipeline

Every import — whether from drag-and-drop, the file picker, or a watched folder — follows the same pipeline:

```
Source file
  │
  ▼
┌──────────────────────────────────┐
│ 1. Stream to temp                │
│    Copy to objects/.tmp/{uuid}   │
│    Compute SHA-256 in same pass  │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 2. Duplicate check               │
│    Look up content_hash in DB    │
│    If match → discard temp file  │
└──────────────┬───────────────────┘
               │ (new file)
               ▼
┌──────────────────────────────────┐
│ 3. Finalize                      │
│    Atomic rename from .tmp/ to   │
│    objects/{uuid}.{ext}          │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 4. Database insert               │
│    Create document record with   │
│    category = NULL (Inbox)       │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 5. PDF text extraction           │
│    If PDF and < 50 MB, queue     │
│    extraction in Worker thread   │
│    Result saved to extracted_text│
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 6. Smart suggestions             │
│    Run keyword matcher on text   │
│    If Ollama enabled, also call  │
│    LLM for category + filename   │
│    Results saved as suggestions  │
└──────────────────────────────────┘
```

This design ensures:

- **No partial files** — documents live in `.tmp/` until fully written, then are atomically renamed
- **No duplicates** — the SHA-256 hash is checked before committing the file
- **Non-blocking extraction** — PDF text parsing runs in a separate Worker thread so the UI stays responsive
- **Automatic suggestions** — category and filename suggestions are generated in the background after extraction completes

### Workspaces

File Harbor supports multiple workspaces. Each workspace is an independent library folder with its own `db.sqlite`, `objects/` directory, and optional watched folder. One workspace is active at a time.

On first launch, a **Default** workspace is created automatically. You can add more workspaces from the dropdown in the sidebar, and switch between them at any time. Switching workspaces tears down the current database and services, then reinitializes with the selected workspace's library folder.

Workspace configuration (names, paths, active selection) is stored in `settings.json` in Electron's `userData` directory. Existing users upgrading from the single-library format are automatically migrated — their library becomes a "Default" workspace with no action required.

Removing a workspace only removes it from the list — the library folder and its files are never deleted.

### Watched Folder

Each workspace can have its own watched folder. The watched folder uses chokidar with these settings:

- Only watches the top-level directory (no subdirectories)
- Ignores dotfiles, `.DS_Store`, Office temp files (`~$`), `.tmp`, `.crdownload`, and `.part` files
- Waits for a 2-second write stability threshold before processing (so in-progress downloads aren't picked up)
- Feeds into the same ingestion pipeline described above

### Smart Suggestions

File Harbor can automatically suggest a category and a descriptive filename for newly imported documents. Suggestions are generated in two tiers:

1. **Keyword matching** — a built-in rule engine scans extracted text and filenames for category-specific keywords and regex patterns (e.g. "w-2" → Taxes, "policy number" → Insurance). This runs instantly with no external dependencies.
2. **Ollama LLM** (optional) — if a local [Ollama](https://ollama.com/) instance is running, File Harbor sends a prompt with the first 2,000 characters of extracted text and asks the model to return a category, confidence score, and suggested filename in `YYYY-MM-DD Description.ext` format. Configure the base URL and model name in Settings.

Filename suggestions are built from dates and known entities (banks, insurers, government agencies, etc.) found in the document text, combined with category context — e.g. `2025-10-15 Chase Statement.pdf`.

Suggestions appear as chips on each document row. You can accept or dismiss them individually, or use the **batch filing** dialog to process all pending suggestions at once. Suggestion outcomes (accepted/dismissed) are tracked so you can review accuracy over time.

### Backup and Restore

Each workspace can be backed up and restored from the File menu:

- **Back Up Workspace** copies `db.sqlite` and the `objects/` directory (excluding temp files) to a user-chosen folder, along with a `backup-meta.json` manifest containing the timestamp, app version, document count, and total size.
- **Restore from Backup** validates the selected backup folder, then replaces the current workspace's database and files with the backup contents. The app reinitializes after restore.

### Bulk Export

**Export All Files** (File menu) exports every document in the current workspace to a destination folder, organized into subfolders by category (with unfiled documents going into an `Inbox` folder). An `export-manifest.json` is written alongside the exported files containing metadata for each document.

### Custom Protocol

Documents are served to the renderer via a custom `file-harbor://` URL scheme:

```
file-harbor://objects/{uuid}.{ext}
```

The protocol handler validates that the requested path starts with `objects/` and resolves within the library directory, preventing directory traversal.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
