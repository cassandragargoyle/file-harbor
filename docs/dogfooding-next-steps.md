# Dogfooding Next Steps

## Pain Points You'll Hit First

### 1. Batch operations

Filing one document at a time will get tedious fast. Multi-select (shift-click, cmd-click) with bulk file/delete/export would be a huge quality-of-life win.

### 2. Tags / custom metadata

The 12 fixed categories are a good start, but real documents often span categories (e.g., a medical receipt is both "Medical" and "Receipts"). Tags or user-defined labels would add flexibility without replacing the category system.

### 3. Rename documents

Inevitably you'll import something with a bad filename (`scan_20240315_001.pdf`). Being able to rename in-place is basic but essential.

### 4. Sort & filter improvements

Sorting by date/name is fine for now, but filtering by date range, file type, or size will matter as the library grows. Also, reverse sort order toggle.

### 5. Progress/status for PDF extraction

When bulk-importing PDFs, there's no visibility into the extraction queue. A small indicator (e.g., "Indexing 3 files...") would reduce uncertainty.

## Stability & Confidence

### 6. Automated tests

Zero test coverage currently. Before adding more features, even a small suite of tests on the critical path (ingest pipeline, duplicate detection, search, database operations) would give confidence nothing breaks during iteration.

### 7. Undo / trash

Dogfooding means you _will_ accidentally delete something. A soft-delete/trash system with a 30-day retention would prevent data loss.

## Medium-Term (After Living With It)

### 8. Smarter search

As the library grows, search filters (`type:pdf category:taxes 2024`) and highlighted search result snippets showing _where_ the match was found would help.

### 9. Date metadata extraction

Automatically pulling dates from PDF content or filenames would make chronological browsing much more useful.

### 10. Drag to file

Being able to drag a document _out_ of the app to file it into a category (or into Finder/Explorer) would feel natural.
