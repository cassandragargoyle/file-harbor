# Requirements: Document Cabinet MVP (Electron, digital intake only)

## 1. Goal

Build a simple desktop app that ingests existing digital documents into a single personal library, provides a stable filing cabinet (fixed categories), and makes it easy to get to "Inbox Zero" without relying on tags, scanning, or mobile.

## 2. Non-goals (explicitly out of scope for MVP)

- Mobile app and scanning
- Email ingestion
- Cloud provider connectors (Drive/Dropbox/iCloud)
- Natural language Q&A
- Automated retention reminders or expirations
- Multi-user sharing/collaboration

## 3. Target user

A single person who already has digital documents scattered across Downloads, Desktop, and random folders, and wants a clean, stable place to store and organize them.

## 4. Core concepts

- **Library**: app-managed storage location on disk that contains all ingested documents and metadata.
- **Inbox**: documents that have been ingested but not yet filed to a category.
- **Cabinet**: a set of fixed categories where filed documents live.
- **Document**: a stored file plus metadata (category, source, timestamps, etc.).

## 5. User stories

- As a user, I can drag and drop files into the app and they appear in my Inbox.
- As a user, I can select a "watched folder" and any new files placed there are ingested automatically into the Inbox.
- As a user, I can file an Inbox document into a category with one click (or a keyboard shortcut).
- As a user, I can browse documents by category in a simple sidebar.
- As a user, I can search my library by filename and (when available) document text.
- As a user, I can open a document preview and export/share the original file.
- As a user, I can see where the library lives on disk and back it up.

## 6. Functional requirements

### 6.1 Library setup

- On first run, user chooses a library location (default suggestion: user Documents directory).
- App creates a library folder structure and a local database file.
- App provides "Open library folder" action.

### 6.2 Intake methods

**A) Drag-and-drop + file picker**

- Accept common formats: PDF, PNG, JPG/JPEG, TXT, DOCX (others can be allowed but not guaranteed to preview).
- Ingest means: copy file into the library, create a Document record, and add to Inbox.

**B) Watched folder**

- User can configure one watched folder.
- App monitors the folder for new files and ingests them.
- Ingested files are copied into the library (not moved) by default.

### 6.3 Inbox

- Inbox lists unfiled documents sorted by most recent first.
- Each row shows: filename, added date/time, source (drag-drop or watched folder).
- Actions:
  - Assign a category
  - Delete from library
  - Open/preview

### 6.4 Cabinet categories

- Use a fixed set of categories (MVP default):
  - Identity
  - Taxes
  - Banking
  - Insurance
  - Medical
  - Home
  - Work
  - Kids
  - Receipts
  - Legal
  - Utilities
  - Other

- Users can file documents into exactly one category.
- Cabinet view shows documents in selected category, sortable by date/name.

### 6.5 Document viewer

- For PDFs and images: show an in-app preview.
- For unsupported formats: show basic metadata and an "Open in default app" button.
- Actions in viewer:
  - Change category
  - Export (save a copy elsewhere)
  - Reveal in Finder/Explorer

### 6.6 Search

- Search by filename and metadata across the library.
- If text extraction is available:
  - PDFs: extract selectable text where present (no OCR required for MVP).
  - Store extracted text in the database for search indexing.

### 6.7 De-duplication

- Compute a file hash during ingest.
- If an identical hash already exists:
  - Default behavior: warn user and skip ingest, or allow "keep both" (simple prompt).

### 6.8 Delete behavior

- "Delete" removes the document from the database and deletes the stored file from the library.
- Optional "soft delete" is out of scope unless trivial.

## 7. UX requirements (simple)

- Left sidebar: Inbox + category list
- Main content: document list
- Top bar: search input
- Keyboard shortcuts (minimum):
  - `F` to file selected doc (opens category picker)
  - `Enter` to open preview
  - `Delete` to delete

- Keep interactions low-friction, no folder management UI.

## 8. Data model requirements

Store in a local SQLite database:

Document fields:

- id (uuid)
- original_filename
- stored_path (relative to library)
- mime_type / extension
- size_bytes
- added_at
- source (dragdrop | watched_folder)
- source_path (original path, optional)
- category (nullable until filed)
- content_hash (sha256)
- extracted_text (nullable)
- updated_at

## 9. Storage layout requirements

Inside the library folder:

- `db.sqlite`
- `objects/` (stored files, named by uuid to avoid collisions)
- `previews/` (optional cache, can be skipped in MVP)
- `logs/` (optional)

## 10. Security and privacy requirements (MVP)

- Everything stays local on disk.
- No network calls required for core functionality.
- The app should not transmit document contents anywhere.

## 11. Performance requirements (MVP)

- Ingest: handle at least hundreds of documents without UI freezing.
- Search: instant for filename; acceptable for text search on a few thousand docs.

## 12. Edge cases to handle

- File name collisions (avoid by storing as uuid)
- Files deleted/changed in watched folder after ingest (library copy remains source of truth)
- Partially downloaded files in watched folder (retry or ignore until stable size)
- Large PDFs (preview may be slower, but should not crash)

## 13. Acceptance criteria

- User can create/open a library and see it on disk.
- User can ingest docs via drag-drop and watched folder.
- Ingested docs appear in Inbox.
- User can file docs into fixed categories and browse them.
- User can preview PDFs/images and open unsupported docs externally.
- User can search by filename, and by extracted PDF text when available.
- Duplicate files are detected via hash.
- Deleting a document removes it from library and database.

## 14. Phase 2 (not in MVP, but next)

- On-device OCR for images and scanned PDFs
- Multiple watched folders
- Email ingestion address
- Simple auto-suggestions for category based on filename/text
- Cross-device sync and a web/mobile client
