# Email Ingestion: Feasibility Analysis

## Concept

Users get a unique email address per workspace (e.g., `abc123@ingest.fileharbor.app`). They forward or send emails with file attachments to that address, and the attachments appear in their Inbox — the same as drag-drop or watched-folder imports today.

## Why This Is Non-Trivial

File Harbor is currently a **fully local, zero-network desktop app**. There are no accounts, no authentication, no servers, no cloud storage. Email ingestion breaks that boundary fundamentally — it requires a server-side component to receive mail, and some way to get those files down to the desktop client.

This is the single biggest architectural decision the feature forces: **introducing a cloud relay into a local-first app**.

---

## Architecture Options

### Option A: Cloud Relay (Recommended)

A thin cloud service receives inbound email and holds attachments until the desktop client pulls them.

```
Sender → Email Provider (SES/SendGrid/Mailgun) → Relay API → Desktop Client polls → Local Ingestion Pipeline
```

**Components needed:**
- Inbound email processor (webhook from email provider)
- Object storage for staging attachments (S3 or equivalent)
- Small API for desktop client to poll/pull pending files
- Workspace-to-email-address mapping (database)
- Auth layer so only the right desktop client can pull its files

**Pros:** Reliable email delivery, works while desktop app is closed, handles large attachments gracefully.
**Cons:** Requires running infrastructure, introduces cloud dependency, changes the privacy story.

### Option B: IMAP Polling from Desktop

The desktop app connects directly to an IMAP mailbox and pulls new messages.

```
Sender → Shared Mailbox → Desktop App polls via IMAP → Local Ingestion Pipeline
```

**Pros:** No custom server, familiar email infrastructure.
**Cons:** Requires the app to be running to receive, IMAP libraries in Electron are painful, managing per-workspace mailboxes at scale is operationally complex, credentials management.

### Option C: Local SMTP Listener

The desktop app runs a lightweight SMTP server on a non-standard port, exposed via tunneling (ngrok-style) or local network.

**Pros:** Truly local, no cloud.
**Cons:** Unreliable delivery, NAT/firewall issues, not viable for real users.

**Verdict:** Option A is the only production-viable path. Options B and C have too many operational and reliability problems.

---

## Detailed Design (Option A: Cloud Relay)

### Email Provider

Use an inbound email processing service. All three major options work similarly:

| Provider | Mechanism | Pricing | Notes |
|----------|-----------|---------|-------|
| **AWS SES** | Inbound rules → S3 + Lambda | ~free at low volume | Best if already on AWS |
| **SendGrid Inbound Parse** | Webhook POST on receive | Free tier available | Simplest to set up |
| **Mailgun Routes** | Webhook POST on receive | Free tier: 100 emails/day | Good docs, generous free tier |

All follow the same pattern: configure a domain's MX records, provider receives mail, fires a webhook to our API with the parsed email (headers, body, attachments).

### Relay API

Minimal service with ~4 endpoints:

```
POST   /webhooks/inbound-email     # Called by email provider
GET    /workspaces/:id/pending     # Desktop polls for new files
GET    /files/:id/download         # Desktop downloads a staged file
DELETE /files/:id                  # Desktop confirms receipt, cleanup
```

**Tech choices:** Any lightweight framework works. A single Lambda + API Gateway setup or a small Node/Express service on Fly.io would be sufficient.

### Staging Storage

Attachments land in S3 (or equivalent) with a TTL. Files older than 7 days get auto-deleted — this isn't meant to be durable storage, just a handoff buffer.

### Desktop Client Changes

New service: `EmailPollService` (sibling to `WatcherService`).

```typescript
// Pseudocode for the polling loop
class EmailPollService {
  private interval: NodeJS.Timeout;

  start(workspaceId: string, apiToken: string) {
    this.interval = setInterval(async () => {
      const pending = await fetch(`${RELAY_URL}/workspaces/${workspaceId}/pending`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });

      for (const file of pending.files) {
        const buffer = await fetch(`${RELAY_URL}/files/${file.id}/download`, ...);
        // Feed into existing ingestion pipeline
        await ingestFile(buffer, file.originalFilename, 'email');
        await fetch(`${RELAY_URL}/files/${file.id}`, { method: 'DELETE', ... });
      }
    }, 30_000); // Poll every 30s
  }
}
```

Key integration points in existing code:
- **`file-service.ts`** — Add `'email'` to the `source` type, extend `ingestFile` to accept a `Buffer` (currently only accepts file paths)
- **`ipc-handlers.ts`** — New handlers for email settings (enable/disable, show address, copy address)
- **`database.ts`** — No schema changes needed beyond adding `'email'` as a valid `source` value
- **`types.ts`** — Extend `DocumentSource` type
- **Settings UI** — New section showing the workspace's email address with a copy button

### Authentication & Identity

This is the biggest new concern. Today there are no accounts. Options:

1. **Anonymous token per workspace** — When the user enables email ingestion, the app registers with the relay and gets back a unique workspace ID + API token. No email/password needed. The token is stored in `settings.json`.
2. **Full user accounts** — Overkill for this feature alone, but inevitable if more cloud features follow.

**Recommendation:** Start with anonymous tokens. A workspace registers, gets a token, and that token authorizes polling. If the user loses the token (reinstall, etc.), they can regenerate it (old email address still works, new token issued).

### Email Address Format

`{random-slug}@ingest.fileharbor.app`

- 8-character alphanumeric slug (e.g., `kx7m2p4q@ingest.fileharbor.app`)
- One address per workspace
- Shown in workspace settings with a copy-to-clipboard button
- User can regenerate the address (invalidates the old one)

---

## Scope Boundaries

### In scope (v1)
- Attachments extracted and ingested into Inbox
- Source recorded as `'email'` in the document record
- Email subject stored as metadata (useful context)
- Supported file types filtered same as existing imports (PDF, images, docx, txt, md)
- Unsupported attachment types silently dropped
- Basic rate limiting (50 emails/day per workspace)
- Polling indicator in the UI (last checked timestamp)

### Out of scope (v1)
- Email body text as a document (just attachments for now)
- Sender allowlisting / filtering
- Push notifications (polling is fine for v1)
- Email threading or conversation tracking
- Reply-to-email workflows
- End-to-end encryption of staged files

---

## Work Breakdown

### Infrastructure (new)
| Task | Effort | Notes |
|------|--------|-------|
| Domain setup + MX records | 1 day | `ingest.fileharbor.app` |
| Email provider integration (SendGrid/Mailgun) | 1-2 days | Webhook handler for inbound parse |
| Relay API (4 endpoints) | 2-3 days | Node service, token auth, S3 staging |
| S3 bucket + lifecycle rules | 0.5 day | 7-day TTL auto-cleanup |
| Deployment (Fly.io or Lambda) | 1 day | Plus CI/CD |

### Desktop Client
| Task | Effort | Notes |
|------|--------|-------|
| `EmailPollService` | 1-2 days | Polling loop, download, feed to ingest pipeline |
| Extend `file-service.ts` for Buffer ingest | 0.5 day | Currently path-only |
| Add `'email'` source type | 0.5 day | Types, schema, UI badge |
| Workspace registration flow | 1 day | Register with relay, store token |
| Settings UI for email address | 1 day | Show address, copy button, enable/disable toggle |
| IPC handlers for email features | 0.5 day | Wire up new service to renderer |
| Error handling & offline resilience | 1 day | Retry logic, stale token handling |

### Testing & Polish
| Task | Effort | Notes |
|------|--------|-------|
| Integration tests (relay API) | 1-2 days | |
| E2E test (send email → appears in app) | 1 day | |
| Edge cases (large files, bad MIME types, no attachments) | 1 day | |

**Total estimate: ~2-3 weeks of focused work** for one developer, assuming no existing cloud infrastructure.

---

## Ongoing Costs

| Resource | Estimated Cost | Notes |
|----------|---------------|-------|
| Domain (already owned?) | ~$12/year | For `ingest.fileharbor.app` |
| Email provider | Free–$20/month | Mailgun free tier: 100 emails/day |
| Relay API hosting | $5–15/month | Fly.io or Lambda |
| S3 staging | < $1/month | Files deleted after 7 days |
| **Total** | **~$10–30/month** | At low-to-moderate usage |

---

## Risks & Open Questions

1. **Privacy narrative shift** — File Harbor's pitch is "your files, your machine, no cloud." Email ingestion puts files on a server, even temporarily. Need clear messaging about what's staged where and for how long. Encryption at rest on S3 is table-stakes.

2. **Spam / abuse** — Public-ish email addresses will eventually get spam. Rate limiting and attachment-type filtering help, but may need sender verification later.

3. **Offline handling** — If the desktop app is closed for a week, staged files pile up. The 7-day TTL means files could expire before the user opens the app. May need to extend TTL or notify somehow.

4. **Large attachments** — Email attachment size limits (~25MB for most providers) naturally cap this, but the relay needs to handle it gracefully.

5. **Token security** — The API token stored in `settings.json` on the user's machine. If compromised, attacker can poll the user's staged files. Token rotation and the ability to regenerate addresses mitigate this.

6. **Multiple devices** — If a user runs File Harbor on two machines with the same workspace, which one gets the files? Need to decide: first-to-poll wins, or both get copies.

---

## Alternatives Considered

**"Just use the watched folder"** — User sets up a mail rule in their email client to auto-save attachments to a folder that File Harbor watches. Zero infrastructure, works today. Downside: requires per-client mail rule setup, doesn't work on mobile, fragile.

**Native IMAP in the app** — User configures their own email credentials. Too much complexity for users, credential management liability, and doesn't give the clean "email this address" UX.

**Browser extension** — Intercept Gmail/Outlook attachments and save to watched folder. Interesting but platform-specific and a separate product.

---

## Recommendation

Email ingestion is a strong feature for the "scan it and forget it" use case — snap a photo of a receipt, email it from your phone, and it lands in File Harbor. But it's a significant architectural expansion.

**If the goal is to ship quickly:** Document the watched-folder workaround and move on to higher-leverage features.

**If email ingestion is a priority:** Start with the cloud relay approach. Use Mailgun (simplest inbound parse), a minimal Fly.io service, and S3 staging. Anonymous workspace tokens keep it simple. Budget 2-3 weeks and ~$15/month in infrastructure.

The desktop-side changes are modest — most of the work is standing up the relay service and email provider integration.
