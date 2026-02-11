# Export All Files

## Overview

Allow users to export all of their documents out of File Harbor into a regular folder on disk. Files should be exported using their human-readable metadata names — not the internal UUID-based storage names — so the result is a clean, usable folder of well-named documents.

## Current State

Today there is a single-document export: right-click a document → "Export" → OS save dialog pre-filled with `original_filename`. Under the hood this is just `fs.copyFile(objects/{uuid}.{ext}, destination)`.

There is no bulk export. If a user wanted all their files, they'd have to export them one at a time, or go spelunking in the `objects/` directory and try to match UUIDs back to filenames manually.

## What the Export Should Produce

Given a library with documents filed across categories, the export should produce a folder structure like:

```
Export_2026-02-11/
├── Taxes/
│   ├── 2025-04-15_IRS_Tax-Return.pdf
│   ├── 2025-01-31_Employer_W2.pdf
│   └── 1099-INT_Chase.pdf
├── Banking/
│   ├── 2025-12-01_Chase_Statement.pdf
│   └── 2025-11-01_Chase_Statement.pdf
├── Medical/
│   └── Lab-Results_2025-10-15.pdf
├── Inbox/
│   ├── scan_20250901.pdf
│   └── photo_receipt.jpg
└── export-manifest.json
```

### Filename Resolution Strategy

Each document has up to three name candidates. The export should pick the best available:

| Priority | Source | Field | Notes |
|---|---|---|---|
| 1 | Accepted suggested filename | `suggested_filename` (when `suggestion_outcome = 'accepted'`) | Cleanest name — AI/keyword-generated, user-approved |
| 2 | Original filename | `original_filename` | Whatever the file was called before import |
| 3 | UUID fallback | `id` + extension | Last resort if somehow both are missing |

For the `suggested_filename` field — this contains names like `2024-01-15_Chase_BankStatement` without an extension. The export would need to append the correct extension derived from `mime_type` or from the `stored_path`.

### Handling Name Collisions

Multiple documents could resolve to the same filename (especially `original_filename` — lots of people have `document.pdf` or `scan.pdf` multiple times). Strategy:

- Append a numeric suffix: `scan.pdf`, `scan (2).pdf`, `scan (3).pdf`
- Track used names per output directory
- This mirrors how macOS Finder and Windows Explorer handle copy collisions, so it will feel familiar

### Folder Structure Options

A few approaches to consider:

**Option A: Category folders (recommended)**
Group by category. Unfiled documents go in an `Inbox/` folder. Simple, mirrors the in-app mental model. This is probably what users expect.

**Option B: Flat folder**
All files dumped into one directory. Simpler to implement but less useful — loses the organizational work the user did. Could be offered as a checkbox: "Organize by category".

**Option C: Date-based folders**
Group by year or year-month based on `added_at`. Useful for chronological archives but doesn't reflect how the user actually organized things.

Recommendation: default to **Option A** (category folders), with a flat export as a secondary option.

### Export Manifest

Include an `export-manifest.json` at the root of the export. This serves as a record and could help with re-import:

```json
{
  "exportedAt": "2026-02-11T14:30:00Z",
  "appVersion": "1.0.0",
  "workspaceName": "Personal Documents",
  "documentCount": 47,
  "documents": [
    {
      "exportedFilename": "Taxes/2025-04-15_IRS_Tax-Return.pdf",
      "originalFilename": "scan_20250415.pdf",
      "category": "Taxes",
      "addedAt": "2025-04-20T10:15:00Z",
      "sizeBytes": 245000,
      "contentHash": "sha256:abc123..."
    }
  ]
}
```

This manifest is useful for auditing ("what was in this export?") and could also serve as a lightweight basis for re-import, though the full backup feature (separate doc) is better suited for that.

## UX Flow

1. **Entry point**: File menu → "Export All Files..." or a button in Settings / a toolbar action
2. **Destination picker**: OS folder selection dialog — "Choose where to save the export"
3. **Options dialog** (optional, could defer to v2):
   - Organize by category vs. flat
   - Include unfiled (inbox) documents: yes/no
   - Include export manifest: yes/no
4. **Progress indicator**: "Exporting 23 of 47 files..." — bulk copy could take a while for large libraries or big files
5. **Completion toast**: "Exported 47 documents to ~/Desktop/Export_2026-02-11" with an "Open Folder" action

## Implementation Approach

### New IPC Channel

`DOCUMENTS_EXPORT_ALL: 'documents:export-all'`

### Main Process Handler

```
1. Query all documents from database
2. Show folder selection dialog for destination
3. Create timestamped root folder (Export_YYYY-MM-DD)
4. For each document:
   a. Resolve best filename (suggested → original → uuid)
   b. Determine output subfolder (category or "Inbox")
   c. Create subfolder if needed
   d. Handle name collisions (append numeric suffix)
   e. fs.copyFile(source, destination)
   f. Report progress to renderer
5. Write export-manifest.json
6. Return summary { exported: number, failed: number, path: string }
```

### Filtering Options

Consider allowing the user to export a subset:
- Export only a specific category
- Export only the current search results
- Export selected documents (multi-select + export)

These could come later, but the architecture should accept an optional filter (category, document IDs, etc.) rather than hardcoding "all documents."

## Edge Cases

- **Missing files**: A document record exists in the DB but the file is gone from `objects/`. Log a warning, skip it, include in a "failed" count. Don't abort the whole export.
- **Very large libraries**: Hundreds or thousands of files. The copy loop should yield to the event loop periodically and report progress. Consider batching with `setImmediate` between copies.
- **Disk space**: No easy way to pre-check if the destination has enough space. If a copy fails mid-export due to ENOSPC, report what succeeded and what failed.
- **Special characters in filenames**: Suggested filenames should already be sanitized, but `original_filename` could contain anything. Sanitize for the target OS (no `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|` on Windows; no `/` and no null bytes on macOS/Linux).
- **Long paths**: Windows has a 260-char path limit by default. Keep category folder names short and truncate filenames if needed.
- **Concurrent modification**: User could import/delete while export is running. Take a snapshot of document IDs at export start and work from that list.

## Open Questions

- Should "Export All" be in the File menu, the Settings page, or both?
- Should we support exporting to a zip file instead of (or in addition to) a folder? Zips are more portable and easier to share, but slower to produce and harder to browse.
- Should the export include extracted text or other metadata beyond the manifest? (Probably not for the basic export — that's what backup is for.)
