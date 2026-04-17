# Offline & Data Model

Reference loaded for Offline-critical features and any feature with full-offline or offline-first posture.

This file decides **sync strategy, conflict resolution, data model for sync, and queue semantics**. Implementation details (specific database engines, serialization formats, background task APIs) live in mobile rules.

---

## When Offline Changes Architecture

Offline is not a feature you add late — it rewrites the data flow. Decide offline posture at the architecture stage, not after. The posture (None / Read-only / Full / Offline-first) is set in `nfr-taxonomy`; this reference handles the consequences.

Retrofitting Full or Offline-first onto an online-first codebase is a rewrite, not an addition. The cost of committing early is low; the cost of committing late is a second system.

---

## Source-of-Truth Model

First decision: where does authoritative data live?

| Model | Authority | Network role | Use |
|-------|-----------|---------------|-----|
| **Server-authoritative** | Server | Primary read path | Online-first, occasional cache |
| **Client-authoritative** | Client | Backup / sync target | Single-user tools (local-first note apps) |
| **Collaborative (dual authority)** | Shared | Equal partners | Multi-user collaborative editing |

For features marked **Offline-first** in NFR, the client holds SSOT for that user's data. The server is a backup and sync target, not the primary read path. For **Full offline** without offline-first commitment, the server remains authoritative and the client maintains a durable local mirror.

---

## Sync Strategy

Decide how changes flow between client and server.

| Strategy | Mechanism | Fit |
|----------|-----------|-----|
| **Full refresh** | Client re-fetches entire dataset on demand | Small datasets, infrequent updates |
| **Delta sync (server-push)** | Server pushes changes to client via real-time channel | Real-time + offline combined |
| **Delta sync (client-pull)** | Client requests changes since last sync token | Default for mobile offline |
| **Optimistic local + background sync** | Client writes locally, syncs in background | Offline-first default |

### Sync Token Model

For delta sync, client tracks a **sync token** (or sync cursor) representing its last reconciled state. Server returns changes since the token and issues a new token.

| Token kind | Trade-off |
|------------|-----------|
| **Timestamp** | Simple, but vulnerable to clock skew and same-millisecond writes |
| **Opaque server-generated** | Flexible — server can change internal scheme without client update; cleaner for correctness |

Default: **opaque token** — prevents clients from doing date math on tokens, lets server evolve sync semantics.

---

## Conflict Resolution

When two writes target the same record (offline client + server + another client), pick a strategy.

| Strategy | Behavior | Use |
|----------|----------|-----|
| **Last-write-wins (LWW)** | Most recent write (by timestamp or version) wins | Simple records; loss of lost writes is acceptable |
| **Server wins** | Server value trumps client offline write | Authoritative server data (prices, inventory) |
| **Client wins** | Client's offline edit trumps server | User's own private content |
| **Three-way merge** | Compare common ancestor + both branches | Structured documents (to a point) |
| **CRDT (conflict-free replicated data type)** | Mathematically-guaranteed convergence | Collaborative real-time editing; high engineering cost |
| **User-resolved** | Surface conflict to user | Cases where automatic resolution is wrong more than it's right |

### Decision Tree

```
Is the data single-user?
├─ Yes (user's own records) → Client wins or LWW
└─ No (multi-user shared data)
    ├─ Authority lies with server (inventory, pricing, permissions) → Server wins
    ├─ Simultaneous collaborative editing required?
    │   ├─ Yes → CRDT (commit to engineering cost) OR session-based access (one editor at a time)
    │   └─ No → LWW with field-level granularity is usually enough
    └─ Merge semantics are domain-specific (calendar, document) → Three-way merge
```

Default: **LWW with server as tie-breaker**. Upgrade only when the feature genuinely collides with multi-user edits.

---

## Data Model for Sync

Models that serialize to local storage and sync cleanly have specific properties.

### Identity

Records need identity **before** they reach the server.

- Client generates a **client-side ID** (UUID) at creation
- Server accepts this ID as canonical, or maps it to its own and returns both
- Never rely on server-assigned auto-increment IDs for offline-created records

If the server uses a separate internal ID, the mapping is a server-side concern; the client continues to use its own UUID forever.

### Timestamps

Every synced record carries:
- `created_at` (immutable, set at creation)
- `updated_at` (bumped on every mutation)
- `version` or vector token (incremented by the winning writer after conflict resolution)

Clocks are unreliable. Prefer server-assigned version tokens over client timestamps when correctness matters.

### Soft Delete

Offline deletion cannot be a hard DELETE — the delete must propagate to other clients that haven't yet synced.

- Record keeps a `deleted_at` or `is_deleted` flag
- Queries filter out soft-deleted records
- Hard deletion happens only after all clients have synced the tombstone (garbage collection)

Alternative: server keeps a **tombstone log** that delta-sync includes. Clients receive "these IDs are deleted" events and remove locally.

### Schema Evolution

Clients offline today may sync months from now on a newer server schema.

- Additive changes (new optional fields) are always safe
- Removing fields requires deprecation window — server accepts and ignores
- Renaming is a delete+add — avoid
- Migrations are per-client on sync, not a single server-side cutover

---

## Write Queue Model

Offline writes accumulate locally. Decide queue semantics.

| Property | Decision |
|----------|----------|
| **Persistence** | Queue lives in durable storage (database), not memory. Survives app termination. |
| **Ordering** | FIFO per entity — earlier writes sync before later writes on the same record. Cross-entity order typically doesn't matter. |
| **Idempotency** | Every queued operation carries a client-generated idempotency key — safe to retry after partial failure. |
| **Retry** | Transient errors (network, 5xx) retry with backoff. Permanent errors (4xx) surface to the user. |
| **Failure visibility** | User learns when a sync permanently fails. Silent drops are the worst failure mode. |

### Optimistic vs Pessimistic UI

- **Optimistic**: UI updates immediately, assumes the sync will succeed. Revert on failure. Default for offline-first.
- **Pessimistic**: UI waits for server confirmation. Fits payments, irreversible actions, anything where showing unconfirmed state is misleading.

---

## Anti-Patterns

- **Offline as afterthought** — adding offline to online-first architecture is a rewrite, not an addition.
- **Timestamp-based sync tokens** — clients with clock skew miss or duplicate changes. Opaque server-issued tokens avoid this entirely.
- **Hard deletes in sync** — offline clients can't know about deletes that happened remotely. Soft delete + tombstones is mandatory.
- **Server-assigned IDs for offline-created records** — client can't reference records it created before server round-trip. Use client UUIDs.
- **Silent sync failures** — queue entries get dropped or retried forever. User never learns. Always surface permanent failures to the user.
- **LWW over fields that conflict meaningfully** — LWW on a document body means one user's entire edit session is discarded. Use field-level LWW or escalate to three-way merge.
- **Write-through assumption in offline-first** — every write blocks on server. Defeats the point of offline. Use write-back with durable queue.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Offline read | `User views [content type] created or fetched earlier without network connection (verified by airplane mode test)` |
| Offline write | `User performs [action] offline; action persists through app termination and syncs on reconnection (verified by offline-queue-survives-restart test)` |
| Conflict resolution | `Concurrent modification of [entity] by multiple clients resolves deterministically with no data loss beyond documented LWW behavior (verified by multi-client conflict test)` |
| Sync visibility | `User sees sync status; permanent sync failures surface with recovery affordance (verified by failure-injection test)` |
| Durable queue | `Pending offline mutations survive app termination, low-storage conditions, and version upgrades (verified by durability test)` |

### Architectural Decisions

```
Source of truth: client-authoritative for user's private data. Rationale: feature must function fully offline including writes; server is the sync target and backup, not the read path.

Sync strategy: delta sync with server-generated opaque sync token, client-pull on app foreground + push notification triggers. Rationale: client-pull is simpler and degrades gracefully; push on critical events keeps latency low; opaque token avoids client clock dependency.

Conflict resolution: last-write-wins at record level, with server as tie-breaker. Rationale: feature is single-user from conflict perspective (same user on multiple devices); simultaneous conflicting edits are rare; CRDT complexity is not justified.

Identity: client-generated UUID at record creation, server treats as canonical ID. Rationale: offline creation must produce referenceable records immediately; server-assigned IDs force round-trips that break offline flows.

Deletion: soft delete with tombstone propagation via sync. Rationale: offline clients need to learn about remote deletes; hard deletes create orphaned references.

Queue semantics: durable FIFO per entity with idempotency keys on every mutation. Rationale: survives app termination and retries safely under partial failure.
```

### Open Questions

```
Conflict UI: when LWW discards a client write, inform the user, or silently accept? Trade-off: transparency vs UX noise. Default for most features is silent unless the discarded write is user-visible and significant.

Sync trigger cadence: on foreground only, or periodic background sync also? Trade-off: background sync keeps data fresh across launches but consumes battery and may run on metered networks.

Tombstone retention: how long does the server keep tombstones before hard-deletion? Trade-off: longer retention supports clients offline for extended periods; shorter retention keeps storage bounded.
```