# Data Model Design for Sync-Capable Apps

Reference for schema design decisions specific to apps that sync data between client and server, operate offline, or handle concurrent edits. Loaded when triage identifies Offline-critical features or when data modeling questions arise during dialogue.

This reference focuses on schema and data structure decisions. The related mechanics — sync engines, conflict resolution, upload queues — live in `offline-sync.md`. This reference covers *what to store* and *how to structure it*; `offline-sync.md` covers *how to sync it*.

---

## Core Principle

Every data model decision in a sync-capable app must answer: **how does this field behave when two devices modify it concurrently, and how does this record behave when it was created offline?**

Schemas that ignore these questions produce apps that appear to work during development, then corrupt user data in production.

---

## Identifier Strategy

Covered in depth in `offline-sync.md` as the "Two-ID Problem" section. Brief summary here:

- **Client-generated UUIDs for new records** — offline creation requires client to generate IDs
- **Server assigns canonical ID on first successful sync** — server may accept client UUID, or issue its own
- **Local-server barrier pattern** — application code uses local IDs everywhere; networking layer translates at boundary
- **Mapping table maintains local ↔ server relationship** — single source of truth for ID resolution

### Schema Implications

- Every entity table has `local_id` (UUID) as primary key
- Optional `server_id` column, populated after successful sync
- Foreign keys use local IDs exclusively
- Mapping table `(local_id, server_id)` resolves only at network boundary

If the application never operates offline, skip this complexity — use server-generated IDs directly. But adding it later is an order-of-magnitude larger refactor than starting with it.

For implementation detail, decision trees, and Dropbox/Trello case studies, see `offline-sync.md` Two-ID Problem section.

---

## Soft Deletes

Deletions in sync-capable apps cannot be destructive operations.

### Why Hard Deletes Break Sync

Consider: user deletes a message offline. Server doesn't know. Server pushes the message back down on next sync. User now sees the message they deleted, with no explanation.

Hard deletion is incompatible with eventual consistency. If the client can't tell server "this was deleted" with a durable marker, sync will keep re-creating the record.

### Soft Delete Pattern

Add a `deleted_at` (nullable timestamp) or `is_deleted` (boolean) column to every syncable entity.

```
items:
  local_id: UUID PRIMARY KEY
  server_id: UUID NULL
  title: TEXT
  deleted_at: TIMESTAMP NULL    ← soft delete marker
  updated_at: TIMESTAMP NOT NULL
```

- **Delete operation**: set `deleted_at` to current timestamp, preserve row
- **Read operations**: filter out rows where `deleted_at IS NOT NULL`
- **Sync operation**: send rows including their `deleted_at` state; server propagates the deletion

### When to Hard Delete

Periodically purge soft-deleted rows that have been successfully propagated to all relevant devices. Trade-offs:

- **Never purge** — table grows forever. Acceptable for low-cardinality data (a user deletes ~1 item/month).
- **Purge after N days** — reasonable default (30-90 days). Assumes all devices have synced by then.
- **Purge after all devices acknowledged** — most correct but requires tracking per-device sync state.

### Schema Implications

- Every query filters `WHERE deleted_at IS NULL` unless explicitly showing deleted items
- Indexes should accommodate this — compound index on `(deleted_at, other_columns)` or partial index `WHERE deleted_at IS NULL`
- Constraints that referenced this row (foreign keys, uniqueness) need to account for deleted rows

### Cascading Deletes

When a parent is soft-deleted, children should typically be marked deleted too — but preserve the parent-child relationship in case of undelete.

Explicit cascade logic, not database-level ON DELETE CASCADE (which is typically hard delete).

---

## Timestamps: Created, Updated, Synced

Every syncable entity needs timestamps beyond just `created_at` and `updated_at`.

### Required Timestamps

**`created_at`** — when the entity was first created. Set on insert, never modified.

**`updated_at`** — when the entity was last modified. Updated on every mutation.

**`client_modified_at`** — when the client made the last local change. Relevant for conflict resolution and sync ordering.

**`server_synced_at`** (client-side) — when the client last successfully synced this entity with server. Null until first successful sync.

### Why Client vs Server Timestamps

Using server timestamps exclusively breaks on clock skew. Client times drift from server time — sometimes by minutes, occasionally by hours (dead battery, manual clock changes, timezone transitions).

Using client timestamps exclusively breaks on multi-device scenarios — two phones with slightly different clocks produce inconsistent ordering.

**Correct pattern:**
- Client uses client timestamps for UI display and local sorting
- Server uses server timestamps for canonical ordering and conflict resolution
- Both timestamps are preserved for debugging

### Timestamp Precision

- **Millisecond precision** minimum — second-level precision causes ties
- **ISO 8601 UTC** for serialization — timezone ambiguity causes bugs
- **Monotonic source** — sequence numbers or HLC (hybrid logical clocks) for strict ordering needs

### Sync Cursor Design

For delta sync, server maintains an opaque sync cursor. Client sends last-known cursor; server returns everything newer.

- **Don't use timestamps directly** — clock skew between servers in a distributed backend creates ordering anomalies
- **Use opaque tokens** — Base64-encoded internal state, server can change encoding without breaking clients (see `api-selection.md` and `offline-sync.md` for related patterns)
- **Client stores cursor, not timestamp** — same opacity principle

---

## Denormalization for Mobile

Mobile apps favor denormalized schemas more aggressively than server-side databases.

### Why Mobile Is Different

- **Network I/O is expensive** — every join that requires a round-trip is a cost
- **Disk I/O is local and fast** — extra storage for denormalized data is cheap
- **UI is often list-oriented** — feeds, grids, messages — all want flat records for rendering
- **Battery matters** — fewer queries = less CPU = less battery

Server-side normalization reduces redundancy and simplifies updates. Mobile-side normalization creates multi-step render paths that add latency and battery drain.

### Common Denormalization Patterns

**Embed frequently-accessed relations.**
```
messages:
  id, thread_id, sender_id, body, created_at
  sender_display_name: TEXT    ← denormalized from users table
  sender_avatar_url: TEXT       ← denormalized from users table
```

Rendering a message list doesn't require joining to users table. Send names change rarely; the denormalized copy is tolerable.

**Precompute aggregations.**
```
threads:
  id, title, updated_at
  unread_count: INTEGER         ← precomputed
  last_message_preview: TEXT    ← precomputed
```

Don't count messages on every thread list render. Maintain the count as part of sync.

**Store formatted display strings alongside raw data.**

If a date/currency/distance is displayed repeatedly in the same format, consider storing the formatted string. Trade-offs: storage vs formatting CPU, and format changes invalidate cache.

### Costs of Denormalization

**Update complexity.** When a user changes their display name, every message they've sent needs the denormalized copy updated. Sync engine must handle this, or accept stale denormalized data.

**Storage footprint.** Duplicate data multiplies storage. On mobile with limited storage, this matters.

**Consistency windows.** Denormalized copies are always slightly behind source of truth. Users may see stale names in older messages until sync propagates.

### When to Denormalize

- **Read path is hot** — rendered on every app launch, every feed scroll
- **Source data is relatively stable** — names change rarely; status might change constantly
- **Users tolerate brief staleness** — display name appearing slightly outdated is acceptable; account balance is not

### When to Stay Normalized

- Data changes faster than the UI renders — keep it normalized, join at render time
- Relationships are complex with multiple alternate keys
- Storage is a critical constraint (rare on modern mobile)

---

## Schema Evolution

Apps running in production have users on multiple app versions simultaneously. Schema changes must accommodate this.

### The Basic Problem

- Server schema updated to add `new_field`
- Users on old app don't understand `new_field`, strip it on local save, re-upload to server — now `new_field` is lost

**Or:**

- Client schema updated to add `new_field`
- User on old app never sets `new_field`; new version of app expects it — null dereference, crash

### Additive Changes Only

Canonical rule: schema changes should be additive.

- **Add new columns as nullable** — old code ignores them, new code uses them
- **Never remove columns during grace period** — deprecated but present
- **Never rename columns** — add new name, migrate readers, later deprecate old name
- **Never change column types** — add new column with new type, migrate, deprecate old

### Migration Strategy

When schema must change non-additively:

1. **Release version N with both old and new fields** — new field is authoritative, old field is maintained for backward compatibility
2. **Wait for adoption** — most users upgrade within 30-60 days typically
3. **Release version N+1 that only writes new field** — stops populating old
4. **Wait longer** — users on version N-1 have now upgraded past N
5. **Release version N+2 that removes old field from reads** — remove code paths
6. **Eventually drop column** — schema cleanup

This is slow. Accept the pace. Trying to move faster means breaking users on old versions.

### Client-Side Schema Versions

Each client database has a schema version number. Migrations run on app upgrade.

- **Always forward migration** — version N → N+1 must succeed
- **Never backward migration** — downgrading app requires data wipe (App Store typically doesn't allow downgrade anyway)
- **Idempotent migrations** — running the migration twice is safe (crash during migration, retry on next launch)
- **Test on realistic data volume** — migration that's fast on 100 rows may be untenable on 100,000 rows

### Server-Side Schema Versioning

See `api-selection.md` for API-level versioning. Data schema versioning is related but distinct — API responses can abstract over underlying schema if needed.

---

## Composite Keys and Uniqueness

Traditional databases use auto-incrementing primary keys. Sync-capable apps can't rely on these.

### Global Uniqueness Requirements

**Primary keys must be unique across all clients.** Client A and Client B both create new records offline. Both records sync to server. If both have auto-incremented "id=1", collision.

UUIDs solve this. Every new record gets a UUIDv4 generated client-side. Collision probability is negligible.

### Uniqueness Constraints Beyond ID

Business rules often require other uniqueness constraints:
- Email addresses
- Usernames
- Slug/URL identifiers

**Server-side enforcement only.** Client can do best-effort uniqueness checking by searching local cache, but can't guarantee without round-trip. Accept that duplicate attempts may reach server; server rejects with 409 Conflict; client shows error.

### Compound Uniqueness

"User X liked post Y" — uniqueness is on `(user_id, post_id)`, not on a single column.

- Client may create duplicate "like" records offline if network prevents deduplication
- Server-side unique index catches duplicates on sync
- Client-side sync handler must handle 409 gracefully — delete local duplicate, keep server-canonical version

### Avoid Surrogate Keys on Natural Uniqueness

If `(user_id, post_id)` is the natural key for likes, don't create a surrogate `like_id`. The compound key is the identity. Adding surrogate IDs creates two identities to reconcile.

---

## Audit Trails and Change History

Some features require knowing what changed when, who changed it, what it was before.

### Basic Audit Fields

On every syncable entity:
- `created_by` (user ID)
- `updated_by` (user ID)
- `created_at`, `updated_at` (timestamps covered above)

### Change Log vs Current State

Two approaches to history:

**Current state only.** Entity row holds the latest version. History derived from event log or server access logs. Simple, compact.

**Versioned rows.** Every change creates a new row. Current row has `is_current = true`. Historical rows preserved indefinitely. Expensive but complete.

**When to version:**
- Legal/compliance requirements (document history)
- Collaboration features with "see who edited" needs
- Undo functionality beyond last action

**When to not version:**
- Simple CRUD where history isn't a feature
- Storage constraints matter
- Privacy concerns (deleted data should stay deleted)

### Sync of Historical Data

Only sync current state unless versions are a product feature. Historical rows are large and rarely needed on-device.

---

## Common Pitfalls

### Database Auto-Increment Primary Keys

`INSERT INTO items VALUES (NULL, 'title')` — SQL assigns id automatically. Two devices do this offline — both get id=1 — sync collision.

**Mitigation:** UUID primary keys. Application layer generates on create. Database never auto-increments for syncable tables.

### Trusting Client Timestamps

Sort timeline by `created_at` where `created_at` is from client. Users with wrong clocks appear in wrong positions. One user's clock jumps backward — their posts shuffle randomly.

**Mitigation:** client timestamps for display only. Server timestamps for canonical ordering. Trust server for multi-user ordering.

### Hard Deletes

User deletes record locally. Server pushes it back on next sync. User deletes again. Repeat forever.

**Mitigation:** soft delete with `deleted_at`. Tombstone propagates through sync.

### No Schema Version Tracking

App ships with v1 schema. Six months later, v2 schema deployed. Some users still on v1 app. Sync payloads mixed. Bugs everywhere.

**Mitigation:** explicit schema version in every database and every sync payload. Migration logic handles version gaps. Never assume all clients are current.

### Non-Additive Schema Changes

Column `description` renamed to `body`. Old clients POST `description` field, server ignores it silently. User's edits lost.

**Mitigation:** additive schema evolution. Old names kept until all clients upgraded. Slow migration, but correct.

### Denormalization Without Sync

Embed `sender_display_name` in messages. User changes their display name. All their old messages still show old name. No mechanism to update.

**Mitigation:** denormalization requires refresh logic. Sync engine must propagate changes to denormalized copies, or accept documented staleness.

### Unique Constraints on User Input

Server-side unique constraint on email. Client-side form validation checks email "looks unique." User enters email that's unique locally but exists on server. Submit. Server 409. UI doesn't handle it cleanly.

**Mitigation:** treat client-side uniqueness as best-effort. Always handle server-side rejection gracefully. Show specific error message for uniqueness violations.

### Cascade Deletes Hard-Coded in SQL

`ON DELETE CASCADE` at SQL level. User soft-deletes a parent record. Database doesn't cascade (because soft delete isn't actual delete). Children remain with dangling parent reference.

**Mitigation:** application-level cascade logic that respects soft delete semantics. SQL cascades rarely fit sync-capable apps.

### Ignoring Schema Size on Mobile

Desktop-like relational schema with 50 normalized tables. Mobile syncs everything. App takes 2 minutes to load. Database file is 400MB.

**Mitigation:** aggressive denormalization for mobile. Download only what's needed. Use smaller types (int8 vs int64 where range allows). Index strategically.

---

## Required Behaviors — Templates for Skill Output

When skill produces output involving data model concerns:

| Behavior | Template |
|----------|----------|
| Client-generated IDs | `New records created client-side use UUIDs as primary identifiers without requiring server coordination (verified by offline creation test)` |
| Soft delete semantics | `Deleted records preserve row with deletion marker; subsequent syncs propagate deletion to other devices (verified by cross-device deletion test)` |
| Additive schema changes | `Schema changes maintain backward compatibility with previous app versions for at least [N] days (verified by multi-version sync test)` |
| Client timestamp independence | `Records sort correctly across users even with clock skew between devices (verified by skewed-clock integration test)` |
| Uniqueness enforcement | `Duplicate uniqueness constraint violations return clear error to user rather than silent data corruption (verified by constraint violation test)` |
| Migration atomicity | `Schema migrations on app upgrade complete atomically or revert cleanly on failure (verified by interrupted migration test)` |
| Denormalization freshness | `Denormalized fields update within [N] minutes of source data changes (verified by denormalization propagation test)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions involving data modeling:

```
Primary key strategy: client-generated UUIDs for all syncable entities. Rationale: offline creation requires IDs before server round-trip; auto-increment causes collisions when multiple devices create records offline. Source: Two-ID Problem pattern documented in offline-sync.md and Dan Lew Trello sync series.

Deletion semantics: soft delete via `deleted_at` timestamp column. Deletion propagates through sync; periodic purge after 90-day retention. Rationale: hard deletes break sync — server or other devices re-create deleted records on next sync cycle. Retention allows recovery and debugging.

Timestamp strategy: dual timestamps — client_modified_at for local ordering and UI, server_timestamp for canonical cross-device ordering. Both preserved on every record. Rationale: client clock skew breaks cross-device ordering; server-only breaks local UI responsiveness; both prevent either failure mode.

Sync cursor: opaque Base64-encoded token, server-defined internally, never parsed by client. Rationale: cursor scheme can evolve without client changes; avoids client exposure to server-side timestamp/sequence implementation. Source: Slack evolving API pagination pattern.

Denormalization policy: embed display names, avatars, and frequently-read summary data from referenced entities. Update denormalized copies via sync engine on source changes, accept ~N-second staleness window. Rationale: mobile network cost makes joins expensive; UI rendering demands flat records. Trade-off documented in denormalization freshness behavior.

Schema evolution: additive changes only during active migration window. New columns are nullable; old columns deprecated but preserved for [N] days after new app version adoption exceeds 95%. Rationale: non-additive changes break sync for users on older app versions.

Audit fields: every syncable entity carries created_at, updated_at, created_by, updated_by. No full version history unless explicitly required by product feature. Rationale: basic attribution covers most debugging needs without versioning storage overhead.

Uniqueness enforcement: server-side via database constraints, client-side best-effort via local index lookup. Sync handler translates 409 Conflict to user-facing error on constraint violation. Rationale: client cannot guarantee uniqueness without server round-trip; duplicate creation during offline must be recoverable.

Mobile schema sizing: denormalized aggressively; only user-visible data synced; aggregate counts maintained explicitly. Rationale: mobile storage and render latency favor flat structures over normalized relational design typical server-side.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **User described offline-capable feature** → full reference applies — UUIDs, soft delete, schema versioning, timestamps
- **User described collaborative features with concurrent edits** → timestamp strategy, audit trails, uniqueness handling, cross-reference to `offline-sync.md` for conflict resolution
- **User described mobile-first product** → denormalization for mobile, schema sizing concerns
- **User described online-only web app or admin tool** → skip most of this; use server-generated IDs, hard deletes acceptable, standard relational patterns fine
- **User described data requiring audit/history** → audit trail patterns, versioned rows consideration
- **User asked about schema migration** → additive changes, version-bound migration window
- **User asked about Two-ID problem or offline identifiers** → cross-reference to `offline-sync.md` as primary source

---

## Invariants

- Primary keys are UUIDs for any entity that might be created offline
- Deletions are soft; hard deletes are a batch maintenance concern, not a user action
- Timestamps are ISO 8601 UTC with millisecond precision; client and server timestamps both preserved
- Schema changes are additive during any active deployment window
- Denormalization is a conscious choice with a documented freshness expectation
- Client-side uniqueness is best-effort; server enforces canonical rules
- Application-level cascade logic replaces database ON DELETE CASCADE for soft-delete semantics
- Data model decisions that support sync are made at the start; retrofitting sync into a non-sync-aware schema is a rewrite