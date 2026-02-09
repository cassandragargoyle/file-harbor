# Smart Suggestions: Implementation Plan

Hybrid approach — keyword rules (always on) + optional Ollama LLM for higher-quality suggestions.

---

## Database & Type Changes (prerequisite for all phases)

Add to `DocumentRecord` and the SQLite schema:

```
suggested_category    TEXT | null     -- keyword or LLM-suggested category
suggestion_confidence REAL | null     -- 0.0–1.0 score
suggestion_source     TEXT | null     -- 'keywords' | 'ollama'
suggested_filename    TEXT | null     -- suggested rename
```

These fields are populated after import and surfaced in the UI. The user's actual `category` and `original_filename` remain unchanged until they accept a suggestion.

---

## Phase 1: Keyword Rule Engine

**Goal:** Auto-suggest categories and filenames for every imported document using local pattern matching. Zero config, always on.

### 1A — Keyword category matcher

**New file:** `src/main/services/keyword-matcher.ts`

Build a scoring engine that checks `extracted_text` + `original_filename` against keyword lists per category.

```
CategoryRule {
  category: Category
  keywords: string[]          -- simple word/phrase matches (case-insensitive)
  patterns: RegExp[]          -- regex for structured matches (SSN format, policy numbers, etc.)
  weight: number              -- base weight for this category (default 1.0)
}
```

**Scoring algorithm:**
1. Normalize text (lowercase, collapse whitespace)
2. For each category rule, count keyword hits and pattern hits
3. Weight hits: exact multi-word phrases score higher than single words; regex patterns score higher than plain keywords
4. Normalize to 0.0–1.0 confidence
5. Return top match if confidence ≥ 0.3, otherwise return null

**Keyword lists to ship with (starter set):**

| Category | Keywords / Patterns |
|----------|-------------------|
| Taxes | `w-2`, `w2`, `1099`, `1040`, `tax return`, `irs`, `refund`, `adjusted gross`, `filing status`, `taxable income` |
| Banking | `bank statement`, `account balance`, `routing number`, `checking`, `savings`, `wire transfer`, `ach`, `fdic` |
| Insurance | `premium`, `policy number`, `deductible`, `claim`, `coverage`, `insured`, `beneficiary`, `underwriting` |
| Medical | `diagnosis`, `prescription`, `patient`, `medical record`, `explanation of benefits`, `eob`, `copay`, `referral`, `lab results` |
| Receipts | `invoice`, `receipt`, `order confirmation`, `subtotal`, `total:`, `payment received`, `qty`, `item #` |
| Home | `lease`, `mortgage`, `property tax`, `hoa`, `deed`, `appraisal`, `escrow`, `landlord`, `tenant` |
| Identity | `passport`, `driver license`, `driver's license`, `social security`, `birth certificate`, `ssn`, `naturalization` |
| Legal | `contract`, `agreement`, `attorney`, `court`, `plaintiff`, `defendant`, `notarized`, `exhibit`, `jurisdiction` |
| Utilities | `electric`, `water bill`, `gas bill`, `internet`, `billing period`, `meter reading`, `kwh`, `usage summary` |
| Work | `pay stub`, `paystub`, `offer letter`, `employment`, `salary`, `employer`, `benefits enrollment`, `performance review` |
| Kids | `report card`, `enrollment`, `tuition`, `school`, `immunization`, `pediatric`, `guardian` |
| Mail | `usps`, `tracking number`, `postage`, `certified mail`, `return receipt` |

Categories not listed (Family, Other) act as fallbacks — Family when multiple family-member keywords appear, Other as the lowest-confidence default.

### 1B — Filename suggester

**New file:** `src/main/services/filename-suggester.ts`

Extract structured info from `extracted_text` to build a descriptive filename.

**Steps:**
1. **Extract date** — scan for date patterns (`MM/DD/YYYY`, `YYYY-MM-DD`, month name + day + year, etc.). Take the most prominent/first date found. Format as `YYYY-MM-DD`.
2. **Extract entity** — maintain a small lookup of common entity names (banks, insurers, employers, medical providers) and scan for matches. Also try extracting from the first few lines of text (often letterhead).
3. **Build filename** — `{date} {entity} {category-context}.{ext}`
   - Example: `2024-03-15 Chase Bank Statement.pdf`
   - Example: `2024-01-20 Blue Cross EOB.pdf`
   - Fallback if no date/entity found: keep `original_filename` (no suggestion)

### 1C — Integration into import flow

**Modified file:** `src/main/ipc-handlers.ts`

After `db.insertDocument()` and text extraction completes:
1. Run `keywordMatcher.suggest(extractedText, filename)` → `{ category, confidence }`
2. Run `filenameSuggester.suggest(extractedText, filename, suggestedCategory)` → `string | null`
3. Update document record with `suggested_category`, `suggestion_confidence`, `suggestion_source: 'keywords'`, `suggested_filename`

**Timing:** For PDFs, text extraction is async (worker thread). Register a callback on extraction completion to run suggestions. For non-PDF files (txt, md), run immediately since text is available at import.

### 1D — New IPC channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `documents:get-suggestion` | renderer → main | Get suggestion for a specific document |
| `documents:accept-suggestion` | renderer → main | Accept category suggestion (sets `category` and clears suggestion fields) |
| `documents:dismiss-suggestion` | renderer → main | Dismiss suggestion (clears suggestion fields) |
| `documents:accept-rename-suggestion` | renderer → main | Accept filename suggestion |

### 1E — UI: Category suggestion chip

**Modified file:** `src/renderer/components/inbox/DocumentCard.tsx` (or equivalent)

When a document has `suggested_category` and `category === null` (still in inbox):
- Show a subtle chip: `"Suggested: Taxes"` with the category icon
- Two actions: checkmark (accept) and X (dismiss)
- Accepting calls `documents:accept-suggestion` → moves doc to that category
- Dismissing calls `documents:dismiss-suggestion` → clears suggestion

**Modified file:** `src/renderer/components/filing/CategoryPicker.tsx`

When opening the category picker for a document with a suggestion:
- Pre-highlight the suggested category
- Show a small badge: `"AI suggested"` next to it

### 1F — UI: Rename suggestion

**Modified file:** Rename dialog component

When a document has `suggested_filename`:
- Show it as placeholder/ghost text in the rename input
- Add an "Apply suggestion" button that fills the input
- User can edit before confirming

---

## Phase 2: Ollama Integration

**Goal:** Opt-in local LLM for documents where keyword matching has low confidence, and for higher-quality rename suggestions.

### 2A — Ollama detection & settings

**New file:** `src/main/services/ollama-service.ts`

On app startup (and periodically), check if Ollama is running:
```
GET http://localhost:11434/api/tags → list of installed models
```

If reachable, store available models in app state. This is passive detection — no auto-enabling.

**Settings additions** (extend workspace or global settings):

```
ollamaEnabled: boolean          -- false by default
ollamaBaseUrl: string           -- default 'http://localhost:11434'
ollamaModel: string             -- default 'phi3:mini' or user-selected from detected models
suggestionConfidenceThreshold: number  -- default 0.7, above this keywords are "good enough"
```

**New IPC channels:**

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `ollama:check-status` | renderer → main | Check if Ollama is reachable, return available models |
| `ollama:update-settings` | renderer → main | Save Ollama preferences |
| `ollama:get-settings` | renderer → main | Load Ollama preferences |

### 2B — LLM suggestion service

**New file:** `src/main/services/llm-suggester.ts`

When keyword confidence is below the threshold and Ollama is enabled:

1. Build prompt:
   ```
   You are a document filing assistant. Given the following document text,
   respond with ONLY a JSON object (no markdown, no explanation):

   {
     "category": "<one of: Identity, Taxes, Banking, Insurance, Medical, Home, Work, Kids, Family, Receipts, Legal, Utilities, Mail, Other>",
     "confidence": <0.0-1.0>,
     "filename": "<YYYY-MM-DD Description.ext>"
   }

   Document filename: {original_filename}
   Document text (first 2000 chars):
   {extracted_text.slice(0, 2000)}
   ```

2. Call Ollama API:
   ```
   POST http://localhost:11434/api/generate
   { model, prompt, stream: false }
   ```

3. Parse JSON response, validate category is in allowed list
4. Update document with `suggestion_source: 'ollama'`

**Timeout & fallback:** 15-second timeout. If Ollama is slow or down, fall back to keyword result silently.

### 2C — Confidence-based routing

**Modified file:** `src/main/ipc-handlers.ts`

After keyword matching:
- If `confidence >= threshold` → use keyword result, done
- If `confidence < threshold` AND Ollama enabled → queue for LLM suggestion
- If `confidence < threshold` AND Ollama not enabled → use keyword result, mark with lower confidence

LLM suggestions happen asynchronously. The document appears in the UI immediately with the keyword suggestion (or none). When the LLM result arrives, update the record and notify the renderer via an IPC event.

**New IPC event (main → renderer):**
- `documents:suggestion-updated` — sent when an LLM suggestion replaces a keyword suggestion

### 2D — Settings UI

**New component:** `src/renderer/components/settings/OllamaSettings.tsx`

Placed in a settings panel or modal:
- Toggle: "Enable AI-powered suggestions (requires Ollama)"
- Status indicator: green dot if Ollama detected, red if not
- Model dropdown: populated from detected models
- URL input: for non-default Ollama installations
- Confidence threshold slider (advanced, collapsed by default)
- "Test connection" button

### 2E — Ollama detection nudge

On first launch (or when Ollama is detected for the first time):
- If Ollama is running but not enabled, show a one-time toast:
  `"Ollama detected — enable AI suggestions in Settings for smarter filing"`
- Don't nag. Store `ollamaNudgeShown: true` in settings.

---

## Phase 3: UX Polish & Batch Processing

**Goal:** Streamline the suggestion workflow for users with many documents.

### 3A — Confidence indicators

In the inbox document list:
- High confidence (≥ 0.7): solid suggestion chip, no indicator
- Medium confidence (0.3–0.7): suggestion chip with `"?"` suffix
- Below 0.3 or no suggestion: no chip shown

### 3B — Batch auto-file

**New component:** `src/renderer/components/inbox/BatchFileDialog.tsx`

Triggered from a toolbar button: `"Auto-file inbox"`

1. Fetch all inbox documents with suggestions
2. Show a review table:
   ```
   | Document          | Suggested Category | Confidence | Action    |
   |-------------------|--------------------|------------|-----------|
   | tax-return.pdf    | Taxes              | 0.92       | ✓ Accept  |
   | mystery-doc.pdf   | Banking            | 0.45 ?     | ✓ / ✗     |
   ```
3. User can accept/reject individually, or "Accept all high-confidence"
4. Single action files all accepted documents

### 3C — Suggestion stats

Add to library info (`library:get-info`):
- Count of documents with pending suggestions
- Accuracy tracking: % of suggestions the user accepted vs dismissed

---

## File Inventory

### New files
| File | Phase | Purpose |
|------|-------|---------|
| `src/main/services/keyword-matcher.ts` | 1 | Category keyword scoring engine |
| `src/main/services/filename-suggester.ts` | 1 | Date/entity extraction for rename |
| `src/main/services/ollama-service.ts` | 2 | Ollama detection & API client |
| `src/main/services/llm-suggester.ts` | 2 | LLM prompt construction & parsing |
| `src/renderer/components/settings/OllamaSettings.tsx` | 2 | Ollama configuration UI |
| `src/renderer/components/inbox/BatchFileDialog.tsx` | 3 | Batch filing review UI |

### Modified files
| File | Phase | Changes |
|------|-------|---------|
| `src/shared/types.ts` | 1 | Add suggestion fields to DocumentRecord |
| `src/shared/schema.ts` | 1 | Add suggestion columns to SQLite schema |
| `src/main/ipc-channels.ts` | 1, 2 | Add suggestion + ollama channels |
| `src/main/ipc-handlers.ts` | 1, 2 | Register new handlers, hook into import flow |
| `src/preload/preload.ts` | 1, 2 | Expose new IPC methods |
| `src/renderer/electron.d.ts` | 1, 2 | Type definitions for new API |
| `src/renderer/lib/ipc.ts` | 1, 2 | Wrapper functions for new channels |
| `src/renderer/components/filing/CategoryPicker.tsx` | 1 | Pre-highlight suggested category |
| `src/renderer/components/inbox/DropZone.tsx` (or document card) | 1 | Show suggestion chip |
| `src/main/services/database.ts` | 1 | Add suggestion query/update methods |

---

## Implementation order

```
Phase 1A  →  1B  →  1C  →  1D  →  1E  →  1F
  ↓
Phase 2A  →  2B  →  2C  →  2D  →  2E
  ↓
Phase 3A  →  3B  →  3C
```

Phase 1 is fully independent and shippable on its own. Phase 2 builds on Phase 1's infrastructure. Phase 3 is polish and can be cherry-picked.
