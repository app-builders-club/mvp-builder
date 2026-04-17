# Offline Sync Architecture

Reference for features requiring local-first or offline-capable behavior. Loaded when triage identifies Offline-critical or Real-time categories (chat, messaging, collaborative apps, field tools, travel apps, anything that must survive connectivity loss).

This reference is based on the Trello mobile offline implementation (Atlassian/Dan Lew 7-part engineering series, 2017) — one of the most detailed published accounts of retrofitting offline to a production online-first app. Use its patterns and failure modes as ground truth.

---

## Architectural Foundation

The single most important decision in offline sync: **where does the UI read from?**

### Online-First (the trap)

Traditional architecture treats the network as the source of truth:

```
UI → Network → Database (cache)
```

User clicks button → UI fires HTTP request → response updates UI → database is incidental.

This architecture cannot be retrofitted to offline with "add a cache layer" or "queue the requests." Every UI path assumes a live server. Offline mode becomes a pervasive rewrite.

### Offline-First (the pattern)

Database becomes the source of truth. Network becomes an optional optimization.

```
UI → Database ← Sync Engine ↔ Network
```

User clicks button → writes to database → UI re-reads database → sync engine eventually propagates to server.

Two architectural commitments this pattern forces:

1. **The database must simulate server logic.** Offline writes must produce the same effect as online writes would. Validation, derived fields, relationships — all of it lives client-side now.
2. **A sync engine bridges database and network.** Uploads local changes, downloads remote changes, resolves conflicts, surfaces sync state to UI.

### When to apply

- **Full offline-first architecture** — apps where offline is a primary feature (field tools, travel, messaging, note-taking)
- **Hybrid approach** — apps where offline is partial (read-only cache for viewing, writes require network) — simpler, most of this reference still applies to the read side
- **Skip entirely** — internal dashboards, admin tools, anything always-connected. Forcing offline-first here is over-engineering.

Confirm with user before recommending offline-first. It is a multi-month commitment, not a feature flag.

---

## Sync Strategy Options

Three canonical approaches for syncing local changes to server. Pick one explicitly — hybrid approaches create complexity without clear benefit.

### Delta-Based Sync

Store field-level changes as structured deltas. Upload each delta separately.

**Data model:**
- **Entry** — high-level change: "create card", "update list", "delete board". Carries metadata: timestamp, state (pending/uploading/failed/cancelled), retry count.
- **Delta** — single field modification within an entry. Points to a field, stores before/after values.

**Upload:**
- Execute deltas in order received (preserves dependencies — can't "edit description" before "create card")
- Convert each delta to HTTP request via generalized mapping: `POST /{model}/{id}?field=value` works for most cases
- Custom code for fields that don't map cleanly (nested resources, relationship changes)

**Rationale:**
- Field-level granularity means partial conflicts don't block entire records
- Delta calculator has reuse beyond sync (conflict analytics, audit trails)
- HTTP requests stay simple per delta

**When to apply:**
- CRUD apps with moderate editing frequency (Trello cards, Notion blocks, task managers)
- Models where most changes touch 1-2 fields at a time
- Existing REST API with field-level PATCH support

### Operation Log Sync

Store operations as append-only log. Replay operations to reconstruct state.

**Data model:**
- Operation = intent (`user_liked_post(post_id=X, user_id=Y, timestamp=T)`)
- Log entries ordered by causal sequence
- Client replays log on receive, server replays log on receive

**Rationale:**
- Preserves user intent, not just end state ("incremented counter" vs "set counter to 5")
- Easier conflict resolution — operations can be reordered, end state re-derived
- Audit trail is automatic

**When to apply:**
- Collaborative editing (multiple users operating on same resource concurrently)
- Features where intent matters (counters, lists with insert-at-position, undo/redo)
- When state snapshots are expensive and operations are cheap

Avoid: simple CRUD. Operation log is overkill for features where last-write-wins works.

### Full Sync

Download entire dataset periodically. No incremental logic.

**When to apply:**
- Tiny datasets (user settings, configuration, feature flags)
- Data that rarely changes
- Projects where delta/operation complexity isn't justified

**Avoid for anything larger than a few KB.** Full sync over cellular drains battery and data. For anything else, use delta or operation log.

---

## Upload Pipeline

The upload side of sync must assume failure. Design for the worst case, treat success as the exception.

### Queue Persistence

The upload queue must survive app termination. An in-memory queue loses pending operations when the user force-quits or OS kills the app in background.

- Persist queue in the local database, not in memory
- Each pending operation is a durable record
- On app startup, resume queue processing from persisted state

### Order Preservation

Execute uploads in the order they were created.

**Why:** a user creates a card, then edits its description. If "edit description" uploads first, the server has no card to edit — error, delta lost, UI now shows a card that doesn't exist on server.

Always queue dependencies before dependents. If the data model requires it, enforce order at the sync engine level.

### Failure Categories

Sort upload failures into two buckets:

| Category | Examples | Action |
|----------|----------|--------|
| **Temporary** | Network timeout, 503, 504, 502, some 500s, network unreachable | Retry with exponential backoff |
| **Permanent** | 400, 401, 403, 404 on the resource, 422 validation failure, HTTP status indicating "will never succeed" | Drop delta, log for analytics, continue |

Categorize by HTTP status code. Anything in the "temporary" list is safe to retry. Anything else gets discarded — retrying won't help.

### Retry with Exponential Backoff

Temporary failures retry with increasing delays to avoid hammering a struggling server.

- Start with short delay (1–5 seconds)
- Double on each attempt (1s, 2s, 4s, 8s, 16s)
- Cap at a reasonable ceiling (1–5 minutes)
- Add jitter to prevent thundering herd on backend recovery

**Cap the total retry count.** After N attempts (typically 5–10), treat the delta as permanently failed. Infinite retry loops drain battery and data for no benefit.

### Idempotency

The most insidious failure: client sends request → server receives and processes → network drops before response → client thinks it failed → client retries → server creates duplicate.

**Solution: client-generated idempotency keys.**

- Client generates UUID per mutation
- Send in header: `Idempotency-Key: <uuid>`
- Server stores `(key → response)` mapping for 24+ hours
- On duplicate key: return cached response without re-executing

This is non-negotiable for any non-idempotent mutation that goes through a retry-capable sync system. Without it, retries corrupt data.

Reference: covered in detail in `backend.md` canonical API patterns — sync engine is one of the primary consumers of idempotency keys.

### Reverting Data on Permanent Failure

When a delta permanently fails (400-class error), the UI already shows the optimistic change. The database has the "fake" state. Options:

**Lazy revert (Trello's initial approach):** let the next GET from server overwrite the local database. Simple, but:
- Problem: can blow away other legitimate unsynced changes
- Mitigation: always upload pending changes before downloading
- Mitigation: replay local queue against freshly-downloaded data

**Explicit revert:** on permanent failure, compute the inverse of the delta and apply to local database. More work upfront, cleaner semantics.

**When to apply each:** lazy revert is the pragmatic MVP choice. Explicit revert becomes worthwhile when users notice data inconsistencies or when analytics show frequent revert scenarios.

---

## Download Strategy

Sync is a two-way street. Upload alone keeps the user's device authoritative about their own changes, but users also need fresh data from other sources (other users, other devices).

### Background Downloads

Schedule periodic background fetches. Balance freshness against battery and data.

**Typical cadence:**
- At most twice per day for full refresh
- More frequently (every 15–30 minutes) for starred/active content
- Immediately on app foreground for content user is about to view

**Never constant background polling.** Users on metered cellular will notice (and uninstall).

### Activity-Based Skipping

Before downloading a full resource, check if it has changed. Most resources haven't.

- Store `last_modified` timestamp per resource on server
- Client sends `If-Modified-Since` header (or equivalent cursor-based mechanism)
- Server returns `304 Not Modified` with empty body if unchanged
- Saves bandwidth and battery on unchanged resources

For deep hierarchies (board → cards → checklists), check the top level first. If the board hasn't changed, don't walk into children.

### Intelligent Data Selection

Don't sync everything the user has access to — sync what they actually use.

- Starred, pinned, or explicitly-marked content: always sync
- Recently viewed content: sync on priority
- Never-viewed content: don't sync until first access

This prevents the "I have 500 projects in my account" user from downloading gigabytes they'll never open.

### Priority Queue for Downloads

Unlike upload queue (which preserves order), download queue is priority-ordered.

| Priority | Trigger |
|----------|---------|
| Immediate | User just opened a resource — fetch now |
| High | User received notification for a resource |
| Medium | User is viewing parent resource — prefetch children |
| Low | Background refresh of starred content |
| Idle | Full refresh of everything user might access |

Remove items from queue when they become irrelevant. User opens card, changes mind, closes — cancel the pending fetch.

### When to apply

- Every offline-capable app needs download strategy (not just upload)
- Priority queue becomes important once data volume exceeds what fits in memory
- Activity-based skipping becomes important once server load or client bandwidth matter

---

## Conflict Resolution

**Counter-intuitive insight from Trello:** conflict resolution was *not* the hardest problem. Most data isn't concurrently edited. Getting sync to work reliably was orders of magnitude harder than resolving conflicts.

Start with the simplest strategy that works. Upgrade only when analytics show real problems.

### Strategy A: Last-Writer Wins (LWW)

The incoming change overwrites existing state. Whoever wrote most recently (by timestamp) wins.

**Pros:**
- Trivial to implement
- Users understand it intuitively — no "resolve conflict" UX
- Works for the vast majority of Trello-style data

**Cons:**
- Silent data loss when two users edit concurrently
- Bad for long-form text fields (losing 500 words is a disaster)

**When to apply:** most features, most fields. Default until analytics prove otherwise.

### Strategy B: LWW with Conflict Analytics

Same as LWW, but instrument conflicts for monitoring. Calculate delta between what was on server and what client uploaded; log a conflict event when they differ meaningfully.

**Purpose:** find the fields where LWW hurts. Trello discovered most conflicts were low-impact, but descriptions (long-form) had real data loss.

**When to apply:** always. Conflict telemetry is cheap insurance.

### Strategy C: Field-Level Merging

For known problematic fields, attempt three-way merge (common ancestor + both changes). If clean merge, apply; if not, fall back to LWW or user resolution.

**Cost:** requires storing common-ancestor state, plus merge logic per field type.

**When to apply:** only for specific fields identified by analytics as conflict-heavy. Don't apply globally.

### Strategy D: User-Facing Conflict Resolution

Server returns HTTP 409 Conflict on mismatch. Client shows UI asking user which version to keep.

**When to apply:** rarely. Users dislike "resolve conflict" dialogs. Only for data where silent loss is unacceptable (financial records, contracts).

### Strategy E: Operational Transform (OT) / CRDTs

Structured data types designed to merge cleanly without conflicts. OT powers Google Docs; CRDTs power Figma, Linear, some collaborative tools.

**When to apply:**
- Real-time collaborative editing (multiple users editing same field simultaneously)
- Feature is the primary reason the product exists (you're building a collaboration tool, not just adding it)
- Team has capacity for months-long infrastructure investment

Avoid as a defensive choice. OT/CRDT complexity is substantial.

### Decision Tree

1. Does the feature involve concurrent editing of the same resource?
   - No → LWW is fine
   - Yes → continue
2. Is concurrent editing rare (most users edit different resources)?
   - Yes → LWW + analytics
   - No → continue
3. Is the concurrent editing primarily in structured fields?
   - Yes → field-level merge for hot spots
   - No → continue
4. Is the data criticality high enough to justify 409 + user UI?
   - Yes → user-facing resolution
   - No → invest in OT/CRDT

---

## The Two-ID Problem

The thorniest problem in offline sync after the happy path works. Must be designed for from the start — retrofitting is painful.

### The Setup

Online-only apps rely on server to generate IDs. User creates resource → POST to server → server returns ID → client stores.

Offline breaks this. User creates resource while offline → no ID yet → but other models need to reference this new resource by ID → client must generate its own ID somehow.

Every offline-capable app hits this. Every solution involves managing *two* identities per resource: a local ID (valid on device immediately) and a server ID (assigned by server on first successful sync).

### Three Approaches — Two Don't Work

**Approach 1: Local ID, switch to server ID after sync**

Generate UUID locally. Use it everywhere. When server assigns canonical ID, update all references.

**Why it fails:** IDs are used for relationships across the data model. Every foreign key, every cache entry, every URL, every log line. Switching the ID means hunting down every reference and updating it. Fragile — missing one reference leaves dangling pointers.

**Approach 2: Identifier pair (local + server)**

Replace every `String id` with `Identifier { localId, serverId }` type. Look up either when needed.

**Why it fails:** massive refactor. Every place in the codebase that touched an ID now deals with a wrapper type. Constant DB lookups to resolve one side to the other. Performance degrades. Code churn is not worth it.

**Approach 3 (the solution): Local-Server Barrier**

Use local IDs *everywhere* in the app. Convert to server IDs *only* at the network boundary. The rest of the codebase never knows server IDs exist.

### The Pattern

```
┌─────────────────────────┐
│  App (uses local IDs)   │
│  ─── UI                 │
│  ─── Database           │
│  ─── Business Logic     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Networking Layer       │
│  Converts:              │
│  local → server (out)   │
│  server → local (in)    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Server (uses server    │
│   IDs)                  │
└─────────────────────────┘
```

**Implementation:**
- Local IDs are UUIDs generated client-side for every resource
- Mapping table in local database: `(local_id, server_id)`
- When sending to server: translate local IDs in payload to server IDs (if known)
- When receiving from server: translate server IDs to local IDs (create mapping if new)
- Annotation-based converter (`@Id` on ID fields) automates the translation

**New records:** initially have only local ID. On first successful upload, server returns server ID. Client stores mapping. Subsequent uploads use the mapping.

### When to apply

- **Always apply this pattern for offline-capable apps.** No exceptions. The two approaches that don't work are sufficiently painful that you will regret skipping this.
- Bake the annotation converter into the networking layer from day one. Retrofitting is hard.
- Store the mapping table with the same durability as the rest of your data.

---

## Offline Attachments

Binary files (photos, videos, documents) behave differently from structured data. A sync architecture that works for JSON will fail for 50MB photos.

### Why Attachments Are Special

**Large:** uploads take minutes, not milliseconds.
**Unreliable:** long upload = many chances for network to fail.
**Permissions:** platform file access is often temporary — file URI granted to app may revoke after a few minutes.

### Permission Handling (Mobile)

When the user picks a file to attach, the OS grants temporary read permission on that URI. Online-only apps upload immediately, so permission expiry isn't a problem.

Offline-capable apps can't upload immediately. By the time sync runs, the permission is gone — file can't be read.

**Solution:** copy the file to app-private storage immediately on pick. Sync uploads from the copy, not the original. Delete copy after successful upload.

This applies to iOS (security-scoped URLs), Android (content URIs), and browsers (File objects).

### Blocking the Queue

A single queue that uploads all pending operations in order has a fatal flaw with attachments: one 50MB upload blocks all other pending changes.

**Scenario:** user attaches photo (queued), then edits card name (queued), then comments (queued). Photo starts uploading, fails, retries, fails, retries... card name and comment stay pending for minutes or hours.

User perception: "the app is broken, my edits don't sync."

**Solution: separate queue for attachments.**

- Non-attachment changes go through primary queue
- Attachments go through secondary queue
- Primary queue processes first (fast, small operations)
- Secondary queue processes independently (can take hours, doesn't block anything)
- Attachments have no children in the model hierarchy, so ordering doesn't cross the boundary

### Failure Handling for Attachments

Attachments can be permanently stuck if the user's network can't ever handle the upload. At some point, give up.

- Cap retry attempts higher than regular operations (10–20 vs 5–10)
- Cap total time spent (e.g., 7 days) before abandoning
- Surface failure to user explicitly: "Couldn't upload photo. Try again?"

### When to apply

- Any app allowing user file uploads where upload can take >5 seconds
- Photo sharing, document apps, messaging with attachments, email
- Also applies to downloads: large media fetches benefit from their own queue

---

## Sync State UI

Users must be able to tell whether their data has reached the server. Without this, they experience ghost data (appears created but nobody else sees it) and lose trust.

But plastering the UI with loading spinners is noise — most of the time everything is synced.

### Three States

Represent every syncable unit in one of three states:

| State | UI | Meaning |
|-------|-----|--------|
| **Synced** | No indicator | All changes have reached server |
| **Queued** | Indicator visible, not animating | Changes exist locally, waiting for network |
| **Syncing** | Indicator visible, animating | Actively uploading right now |

The "no indicator" default keeps the UI clean. Users only see the indicator when something is off.

### Where to Surface It

Don't decorate every field. Choose the units users care about.

Trello surfaces sync state on four units:
- **Boards** — top-level workspace
- **Cards** — primary unit of editing
- **Comments** — users want to know when their message was sent
- **Attachments** — longer-running, most likely to need visibility

**Rule of thumb:** surface sync state on units where the user actively created or edited content. Not on every nested property.

### Parent/Child Propagation

A parent is "not synced" if itself or any child has pending changes. A card is syncing if its description changed, or if its attachment is uploading.

**Implementation trap:** naive implementation walks the children on every state check. Slow in SQL, slower in SQLite on mobile.

**Pragmatic solution (Trello's approach):** each sync state row stores its parent IDs denormalized. Query becomes a direct lookup by parent ID, not a recursive join. Trade write-time complexity (update denormalized refs) for read-time speed.

### When to apply

- Any app with non-trivial offline editing
- Chat apps: message send status (sent, delivered, read) is the universal pattern
- Collaborative apps: show when peer changes are syncing
- Skip entirely for apps where sync is always-on-foreground (traditional web)

---

## Common Pitfalls

These failure modes appear repeatedly in offline sync implementations.

### Silent Data Loss on Permanent Failure

Delta fails permanently → sync engine drops it → user has no idea. Next time user opens the resource, local database has been overwritten by server, their change is gone.

**Mitigation:** at minimum, log permanently-failed deltas with enough context to notify user ("We couldn't save your changes to X"). Best: explicit revert with UI notification.

### Queue Deadlock from Permanent Failures

Delta A fails permanently but is treated as temporary. Queue retries forever. Delta B waits behind it.

**Mitigation:** cap total retry attempts. Distinguish temporary from permanent errors rigorously by HTTP status code, not heuristics.

### Clock Skew

Using client timestamps to determine which change is "latest" breaks when devices have wrong clocks.

**Mitigation:** use server-generated timestamps or opaque sync tokens. If you must use client timestamps, consider them unreliable for ordering.

### Forgetting Idempotency

Retries without idempotency keys silently duplicate data. User sees two "Pay $100" transactions. Catastrophic.

**Mitigation:** idempotency keys on every non-idempotent mutation from day one. Never retrofit.

### ID Leakage Across the Local-Server Barrier

Somewhere in the code, server ID escapes the networking layer. Database now has mixed IDs. Relationships break.

**Mitigation:** annotation-based enforcement. Single entry/exit point. Code review discipline. Tests that verify no server IDs appear in domain objects.

### Infinite Background Sync

Well-meaning "keep data fresh" runs too often. Battery drain complaints follow. App Store reviews suffer.

**Mitigation:** schedule background sync with OS scheduling APIs (WorkManager, BackgroundTasks). Respect device state — skip on low battery, metered connection. Default to twice daily for full refresh.

### Attachment Queue Paralysis

Single queue blocks on a stuck attachment. User stops seeing their fast edits sync.

**Mitigation:** separate attachment queue.

---

## Required Behaviors — Templates for Skill Output

When skill synthesizes output for an offline-capable feature, these behavior templates apply. Skill picks relevant ones and substitutes specifics.

| Behavior | Template |
|----------|----------|
| Database as source of truth | `UI reads [entity] from local database, not directly from network (verified by airplane mode test showing UI functions without connectivity)` |
| Offline write persistence | `User actions (creates, updates, deletes) on [entity] persist when offline and appear immediately in UI (verified by offline queue test)` |
| Sync on reconnection | `System syncs pending changes within [N] seconds of network recovery (verified by reconnection integration test)` |
| Upload order preservation | `Dependent operations execute in creation order during sync (verified by test creating resource then editing it while offline)` |
| Idempotent retries | `Retrying a failed upload never creates duplicates on server (verified by simulated network drop test)` |
| Exponential backoff | `Failed syncs retry with increasing delays (1s, 2s, 4s, ... capped at [N]min) and stop after [M] attempts (verified by unit test on retry logic)` |
| Permanent failure handling | `Server 4xx responses stop retries and mark delta as failed (verified by test with mocked 400 response)` |
| Sync state visibility | `UI displays sync state indicator on [units] when pending operations exist (verified by UI test showing indicator during simulated network delay)` |
| Two-ID pattern | `Client uses local UUIDs for new resources, converts to server IDs only at network boundary (verified by code review of ID handling)` |
| Attachment queue isolation | `Large file uploads do not block other pending changes (verified by test uploading photo then editing text, text should sync immediately)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions for an offline feature, these templates apply:

```
Sync strategy: delta-based sync with field-level changes stored in local database, uploaded in creation order. Rationale: feature involves field-level edits to structured data, delta approach allows partial conflicts and simpler merge logic. Source: Dan Lew "Syncing Changes" (Trello engineering).

Conflict resolution: last-writer-wins with conflict analytics. Rationale: most data in this feature is not concurrently edited by multiple users, LWW is simpler for users to understand than diff UX, analytics will reveal hot spots requiring field-level merging later. Source: Dan Lew "Sync Failure Handling" (Trello engineering).

ID strategy: local-server barrier. Client generates UUIDs for new resources, networking layer maintains local↔server ID mapping, application code uses only local IDs. Rationale: alternative approaches (switch IDs after sync, paired Identifier type) caused either fragile data updates or massive refactor in Trello's experience. Source: Dan Lew "The Two-ID Problem" (Trello engineering).

Attachment handling: separate upload queue for files, independent of primary data queue. Rationale: large slow attachments would block fast text edits in a single queue, creating perception of broken sync. Source: Dan Lew "Offline Attachments" (Trello engineering).

Sync state UI: three-state indicator (synced/queued/syncing) on boards, cards, comments, attachments. Rationale: users lose trust without visibility into sync state, but ubiquitous indicators create visual noise. Source: Dan Lew "Displaying Sync State" (Trello engineering).

Background download cadence: at most twice daily for full refresh, priority-based immediate fetch for active resources. Rationale: constant polling drains battery and cellular data, while stale data defeats offline mode. Source: Dan Lew "Sync is a Two-Way Street" (Trello engineering).

Idempotency: client-generated UUID per mutation sent via Idempotency-Key header, server stores (key → response) for 24h. Rationale: network drops between server processing and client ack silently duplicate data without this protection. Source: generally accepted pattern, implemented by Stripe, documented in `backend.md`.
```

Skill substitutes specifics ([entity], [N], [M]) based on feature context and dialogue answers.

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers. Entry points:

- **User answered "full offline" or "offline-first" to offline posture** → apply architectural foundation, upload pipeline, Two-ID pattern, conflict resolution. All are required.
- **User answered "read-only offline"** → apply download strategy, activity-based skipping, sync state UI. Upload pipeline not needed.
- **Feature involves file uploads** → apply offline attachments section regardless of offline posture.
- **Feature involves concurrent editing by multiple users** → conflict resolution decision tree, potentially escalate to operation log sync.
- **User answered "eventual consistency" or "read-your-writes"** → LWW default suffices, reference conflict analytics pattern for monitoring.
- **User answered "strong consistency"** → LWW insufficient, reference OT/CRDT section, likely surface red flag about complexity.

---

## Invariants

- Database is always source of truth in offline-first architectures — UI never reads directly from network
- Queues persist across app termination — in-memory queues are bugs
- Idempotency keys are mandatory for all non-idempotent mutations in sync systems
- Local-Server Barrier is the only ID pattern that scales — alternatives have been tried and failed
- Attachment uploads run in a separate queue from structured data
- Sync state is visible to users on units they actively edited
- Conflict resolution starts with LWW until analytics prove otherwise