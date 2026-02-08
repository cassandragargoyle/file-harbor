Todo:

- [ ] Add automated tests: Zero test coverage currently. Before adding more features, even a small suite of tests on the critical path (ingest pipeline, duplicate detection, search, database operations) would give confidence nothing breaks during iteration.
- [ ] Support - Batch operations: Filing one document at a time will get tedious fast. Multi-select (shift-click, cmd-click) with bulk file/delete/export would be a huge quality-of-life win.
- [ ] Support renaming documents: Inevitably you'll import something with a bad filename (`scan_20240315_001.pdf`). Being able to rename in-place is basic but essential.
- [ ] Suppor drag-to-file: Being able to drag a document _out_ of the inbox to file it into a category would feel natural
- Support Undo / trash: Dogfooding means you _will_ accidentally delete something. A soft-delete/trash system with a 30-day retention would prevent data loss.
