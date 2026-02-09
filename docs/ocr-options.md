# OCR Options for File Harbor

## Context

File Harbor handles sensitive personal documents (identity, taxes, banking, medical, etc.) and already extracts text from PDFs via `unpdf`. OCR would fill the gap for **scanned PDFs** (no extractable text) and **imported images** (png, jpg, jpeg, gif, webp).

---

## Local / Offline Options

### Tesseract.js

- Pure JavaScript port of Tesseract OCR — no native dependencies
- Runs entirely in the main process, no external binary needed
- ~15MB for English language data (loaded on demand or bundled)
- Good accuracy on clean scans, weaker on photos/skewed text
- `npm install tesseract.js`
- Straightforward integration with existing file service

### Native Tesseract (via child_process)

- Calls system-installed Tesseract binary
- Better performance than Tesseract.js (C++ vs JS)
- Requires users to install Tesseract separately, or bundle the binary
- More packaging complexity with Electron Forge

### macOS Vision Framework

- Shell out to Swift or use a native addon to call Apple's Vision framework
- Excellent accuracy, especially on Apple Silicon — no extra downloads
- macOS only — would need a fallback for Windows/Linux

---

## Cloud / API Options

### Google Cloud Vision / AWS Textract / Azure AI Vision

- Best-in-class accuracy, handles messy scans, handwriting, receipts
- Costs money per request, requires internet + API keys
- Privacy concern: sends personal documents to third-party servers

### LLM Vision (OpenAI, Anthropic)

- Send images to an LLM for text extraction + intelligent categorization in one step
- Could combine OCR with auto-categorization into the existing category system
- Same privacy and cost concerns as other cloud APIs

---

## Hybrid Approach

Use Tesseract.js by default (private, offline, free) with an opt-in setting for a cloud API when higher accuracy is needed. Matches the local-first spirit of the app (SQLite, file-based workspaces).

---

## Recommendation

**Tesseract.js** is the best starting point:

- Keeps OCR local, preserving privacy for sensitive documents
- No external dependencies to install or bundle
- Fills the gap where `unpdf` can't extract text (scanned PDFs, images)
- Runs in the main process alongside the existing file service
- Covers all supported image formats

### Suggested integration flow

1. On file import, check file type
2. For PDFs: attempt text extraction with `unpdf` first. If no text found (scanned PDF), render pages to images and run Tesseract.js
3. For images: run Tesseract.js directly
4. Store extracted text in the database for search/indexing
