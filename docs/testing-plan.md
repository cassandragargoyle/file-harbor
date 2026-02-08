# Automated Test Suite — Phase 1 (Backend & Utilities)

## Context

File Harbor has zero test coverage. Before adding more features (batch ops, rename, trash, etc.), we need a safety net on the critical paths: file ingestion, database CRUD, settings persistence, and utility functions. This plan covers backend/service tests only — React component tests are phase 2.

## Framework

**Vitest** — natural fit since the project already uses Vite. Single dependency to install.

## Implementation Steps

### Step 1: Install Vitest & configure

- `npm install -D vitest`
- Create `vitest.config.ts` at project root:
  - `test.include`: `src/**/*.test.ts`
  - `test.setupFiles`: `./src/test-setup.ts` (global mocks)
  - `test.environment`: `node`
  - `test.globals`: `true`
  - `resolve.alias`: `@` → `src/renderer` (matches tsconfig)
- Add npm scripts: `test` (`vitest run`), `test:watch` (`vitest`), `test:coverage` (`vitest run --coverage`)

### Step 2: Create global test setup (`src/test-setup.ts`)

Mocks that run before every test file:

- **`electron`** — stub `app.getPath()` (returns temp paths), `app.getAppPath()` (returns `process.cwd()`), `app.isPackaged` = false
- **`electron-log`** — stub with noop logger that has `.scope()` returning `{ info, warn, error, debug }` as `vi.fn()`

This is necessary because `database.ts`, `file-service.ts`, `library-manager.ts`, and `settings.ts` all import from `electron` or `electron-log` at module level.

### Step 3: Test files (in implementation order)

#### 3a. `src/renderer/lib/format.test.ts` — Pure utility functions

- `relativeTime()`: "just now", minutes, hours, days, formatted date, cross-year
- `formatBytes()`: 0 B, bytes, KB, MB, GB, decimal rounding
- Uses `vi.useFakeTimers()` for deterministic dates
- ~12 test cases

#### 3b. `src/shared/constants.test.ts` — Sanity checks

- CATEGORIES has 12 entries, no duplicates
- ACCEPTED_EXTENSIONS all start with `.`, count = 9
- Every extension has a matching MIME type entry and vice versa
- Numeric constants are correct values
- ~10 test cases

#### 3c. `src/main/services/file-service.test.ts` — Ingest pipeline (critical path)

- Uses **real temp directories** (`os.tmpdir()`) — more reliable than mocking fs streams
- `getAbsolutePath` — pure path join
- `validatePathWithinLibrary` — containment check, traversal prevention
- `ingestFileToTemp` — streams file, computes SHA-256, returns metadata
- `finalizeIngest` — renames temp → permanent
- `discardTemp` — cleanup, idempotent
- `deleteStoredFile` — removal, idempotent
- `exportFile` — copies with content integrity
- ~18 test cases

#### 3d. `src/main/services/database.test.ts` — Full database CRUD

- Uses **real SQLite** in temp directory with real Drizzle migrations from `./drizzle/`
- Constructor: creates db.sqlite, runs migrations
- `insertDocument` + `getDocument`: round-trip
- `getDocumentByHash`: lookup + miss
- `getDocumentsByCategory`: filtered queries, null (inbox), ordering
- `updateDocumentCategory`: category change, null, timestamp update
- `updateExtractedText`: set and clear
- `deleteDocument`: removal verified
- `searchDocuments`: partial filename match, extracted_text match, case insensitivity
- `getDocumentCounts`: per-category counts, inbox, zeroes
- `getLibraryStats`: count + size totals
- Helper: `makeTestDoc()` factory with overrides
- ~25 test cases

#### 3e. `src/main/lib/library-manager.test.ts` — Directory management

- `getDefaultLibraryPath`: returns path ending in "FileHarbor" (uses electron mock)
- `initializeLibrary`: creates `objects/`, `objects/.tmp/`, `logs/`; idempotent
- `validateLibrary`: true for valid, false for missing/incomplete
- ~9 test cases

#### 3f. `src/main/lib/settings.test.ts` — Settings persistence & migration

- Override `electron` mock to use per-test temp directory for `userData`
- `getActiveWorkspace`: pure lookup (no fs)
- `loadSettings`: default when missing, loads v2, migrates v1→v2, handles corrupt JSON
- `saveSettings` + round-trip
- `updateSettings`: partial merge
- `updateWorkspace`: targeted update, no-op for missing id
- v1→v2 migration: workspace creation, watchedFolderPath preservation, windowBounds
- ~16 test cases

## Files to create/modify

| File                                       | Action |
| ------------------------------------------ | ------ |
| `vitest.config.ts`                         | Create |
| `src/test-setup.ts`                        | Create |
| `src/renderer/lib/format.test.ts`          | Create |
| `src/shared/constants.test.ts`             | Create |
| `src/main/services/file-service.test.ts`   | Create |
| `src/main/services/database.test.ts`       | Create |
| `src/main/lib/library-manager.test.ts`     | Create |
| `src/main/lib/settings.test.ts`            | Create |
| `package.json`                             | Add test scripts |

## Verification

Run `npm test` from project root — all ~90 tests should pass.
