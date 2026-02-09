# Smart Suggestions: Auto-Category & File Rename

## What We Have Today

- `extracted_text` already stored per document (via `unpdf` for PDFs)
- 14 predefined categories: Identity, Taxes, Banking, Insurance, Medical, Home, Work, Kids, Family, Receipts, Legal, Utilities, Mail, Other
- `original_filename` stored on every document
- Rename feature already exists (`documents:rename` IPC channel)
- Category assignment already exists (`documents:update-category` IPC channel)

Both features would consume `extracted_text` (and optionally `original_filename`) as input and produce a suggestion the user can accept or dismiss.

---

## Approach 1: Keyword / Rule-Based (Local, Zero Dependencies)

Map keywords and patterns to categories using simple heuristics.

### Category suggestion examples

| Pattern | Category |
|---|---|
| `W-2`, `1099`, `tax return`, `IRS`, `refund` | Taxes |
| `bank statement`, `account balance`, `routing number` | Banking |
| `premium`, `policy number`, `deductible`, `claim` | Insurance |
| `diagnosis`, `prescription`, `patient`, `Dr.`, `medical` | Medical |
| `invoice`, `receipt`, `order confirmation`, `total:` | Receipts |
| `lease`, `mortgage`, `property`, `HOA` | Home |
| `passport`, `driver license`, `SSN`, `birth certificate` | Identity |
| `contract`, `agreement`, `attorney`, `court` | Legal |
| `electric`, `water`, `gas`, `internet`, `billing period` | Utilities |

### Rename suggestion approach

Extract structured info from the text to build a descriptive filename:
- Look for dates (regex for `MM/DD/YYYY`, `YYYY-MM-DD`, month names, etc.)
- Look for known entity types (bank names, insurance companies, employer names)
- Combine: `2024-03-15 Chase Bank Statement.pdf`

### Pros
- Runs instantly, no dependencies, fully offline
- Predictable and debuggable
- No privacy concerns

### Cons
- Brittle — only as good as the keyword lists
- Doesn't generalize well to unusual documents
- Requires ongoing maintenance of patterns
- Rename suggestions will be limited without entity recognition

---

## Approach 2: Local LLM via Ollama or llama.cpp

Run a small language model locally to classify documents and generate rename suggestions.

### How it would work

1. User installs Ollama (or we bundle llama.cpp)
2. On import, send extracted text (truncated) to the local model with a prompt like:
   ```
   Given this document text, suggest:
   1. A category from: [Identity, Taxes, Banking, ...]
   2. A descriptive filename in the format: YYYY-MM-DD Description.ext

   Document text: {first 2000 chars of extracted_text}
   ```
3. Parse the structured response and present suggestions in the UI

### Model options
- **Phi-3 Mini (3.8B)** — small, fast, good at classification tasks
- **Llama 3.2 (3B)** — strong general reasoning at small size
- **Gemma 2 (2B)** — very lightweight option

### Pros
- Much smarter than keywords — handles edge cases and unusual documents
- Fully local and private
- Can produce natural-sounding filenames

### Cons
- Requires ~2-4GB disk for model weights
- Slower (seconds per document vs milliseconds for keywords)
- Requires Ollama or similar runtime installed
- Model quality varies — may hallucinate category or filename details

---

## Approach 3: Cloud LLM API (OpenAI, Anthropic, etc.)

Call an external LLM API for the highest quality suggestions.

### How it would work

1. User provides an API key in settings
2. On import, send extracted text to the API with a structured prompt
3. Parse JSON response for category + rename suggestions

### Pros
- Best accuracy and most natural rename suggestions
- No local compute or storage needed
- Easy to implement (single HTTP call)

### Cons
- Sends personal document text to third-party servers (major privacy concern for this app)
- Costs money per request
- Requires internet connection
- API latency (~1-3 seconds per document)

---

## Approach 4: Hybrid (Recommended)

Combine keyword-based rules with an optional local LLM for the best balance.

### Tier 1 — Keyword rules (always on, zero config)
- Run keyword matching on every import automatically
- Fast, free, private, no setup
- Covers the 80% case for common documents (tax forms, bank statements, medical bills)

### Tier 2 — Local LLM via Ollama (opt-in)
- User enables in settings and points to a running Ollama instance
- Used for documents where keyword matching has low confidence
- Produces higher-quality rename suggestions with natural language understanding

### How confidence works
- Keyword matcher returns a score based on number and specificity of matches
- If score is above threshold: show keyword-based suggestion immediately
- If score is below threshold and Ollama is configured: fall back to LLM
- If no LLM configured: show lower-confidence keyword suggestion with a "?" indicator

---

## UX Integration Points

### Category suggestion
- After import, show a subtle chip/badge on the document card: "Suggested: Taxes"
- User clicks to accept (applies category) or dismisses
- Could also show in the filing modal as a pre-selected default

### Rename suggestion
- Show suggested name in the rename dialog as placeholder text
- One-click "Apply suggestion" button
- User can edit the suggestion before accepting

### Batch processing
- "Auto-file inbox" action: apply suggestions to all inbox documents at once
- Review screen showing all suggestions before committing

---

## Implementation Complexity

| Approach | Effort | New Dependencies |
|---|---|---|
| Keyword rules | Low (~1-2 days) | None |
| Local LLM (Ollama) | Medium (~3-5 days) | Ollama runtime (user-installed) |
| Cloud LLM API | Low-Medium (~2-3 days) | API key configuration |
| Hybrid (keywords + Ollama) | Medium (~4-6 days) | Optional Ollama |

## Recommendation

Start with **keyword rules** — they're fast to build, require no dependencies, and can ship immediately. Add **Ollama integration** as a follow-up for users who want smarter suggestions. This keeps the app's local-first philosophy while offering a path to more intelligence.
