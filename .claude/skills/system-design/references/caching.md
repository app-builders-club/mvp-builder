# Caching Strategy

Reference loaded for Data-heavy, Media-heavy, and Offline-critical features.

Implementation rules (cache sizing in MB, memory percentages, specific eviction libraries, HTTP cache headers) live in mobile and backend rules. This file decides **cache layers, invalidation strategy, and coherence model** to commit to in the spec.

---

## When Caching Is a Decision

Cache deliberately when:
- Network round-trips dominate perceived latency (feeds, lists, images)
- Data reuse across sessions is high (same user opens app repeatedly)
- Regeneratable data is expensive to fetch or compute (thumbnails, derived views)
- Offline access is required for previously-viewed content

Skip when:
- Data is highly dynamic (TTL would be near-zero)
- Storage cost exceeds fetch cost
- Consistency requirements forbid stale reads

---

## Cache Hierarchy

Three layers, different characteristics, different decisions per layer.

| Layer | Location | Speed | Capacity | Volatility |
|-------|----------|-------|----------|------------|
| **L1 — Memory** | In-process RAM | Nanoseconds | Tens of MB | Lost on termination |
| **L2 — Disk** | Local persistent storage | Milliseconds | Hundreds of MB | Survives until eviction or uninstall |
| **L3 — Network** | CDN / origin cache | 10s–100s of ms | Effectively unlimited | Controlled by HTTP headers |

Read order: L1 → L2 → L3 → origin. Write order: origin → L2 → L1.

The goal is not to eliminate network — it is to make each layer's hit rate high enough that the network becomes a fallback, not the default.

---

## Per-Layer Decisions

### L1 (Memory)

**What belongs:** decoded bitmaps ready for display, parsed view models, computed per-user state, hot API responses.

**What does not belong:** raw response bodies when L2 also holds them (wastes RAM), large binaries (video, audio, full-resolution images), data that invalidates on every change.

**Decision:** enable L1 for image-heavy or compute-heavy features. Skip for infrequent operations or low-reuse data.

### L2 (Disk)

**What belongs:** encoded response bodies, encoded image bytes, cached thumbnails, offline-available content.

**What does not belong:** sensitive data without encryption (tokens, PII), user-generated content that must survive eviction (that's Documents, not Cache), data that must be authoritative (that's a database, not a cache).

**Decision:** enable L2 for any feature where users return to previously-fetched content, or where offline reads are required.

### L3 (Network / CDN)

**What belongs:** public static assets, cacheable API responses with correct headers, pre-generated thumbnails at standard sizes.

**What does not belong:** per-user dynamic responses, anything requiring fresh reads, authenticated content without Vary headers.

**Decision:** use L3 when ≥80% of traffic is public + static-enough to cache. Otherwise skip.

---

## Invalidation Strategy

The decision that distinguishes working caches from confusing ones.

| Strategy | When to use | Trade-off |
|----------|-------------|-----------|
| **TTL (time-to-live)** | Regeneratable data with tolerable staleness window | Simple; user may see stale content for up to TTL duration |
| **Explicit invalidation on write** | Strong read-your-writes requirement | Correct; cost is routing all mutations through cache-aware layer |
| **Event-driven invalidation** | Multi-user content updated by others | Near-real-time freshness; requires pub/sub infrastructure |
| **Pull-to-refresh only** | User in control of freshness | Simple; no automatic update — users may forget |
| **No invalidation (immutable)** | Content never changes (media by URL) | Cleanest; requires stable content addressing (hashed filenames, versioned URLs) |

### Decision Tree

```
Does this cached content change after creation?
├─ No (immutable by content hash / version) → No invalidation needed
├─ Yes, predictably (user's own writes)
│   └─ Read-your-writes required?
│       ├─ Yes → Explicit invalidation on write
│       └─ No → TTL acceptable
└─ Yes, unpredictably (changed by others or background jobs)
    ├─ Freshness critical (seconds) → Event-driven invalidation
    ├─ Freshness helpful (minutes–hours) → TTL
    └─ Freshness optional → Pull-to-refresh
```

---

## Coherence Model

When multiple layers cache the same data, decide what happens when they diverge.

| Model | Behavior | Use |
|-------|----------|-----|
| **Write-through** | Write hits origin; cache updated synchronously | Default; correctness-first |
| **Write-back** | Write hits cache; origin updated asynchronously | High-throughput writes; acceptable eventual consistency |
| **Write-around** | Write hits origin; cache invalidated (not updated) | Write-heavy, read-rare |

For mobile offline-first features, write-back at the device layer is effectively mandatory (see `offline-and-data.md`). For server caches, write-through is the default unless throughput demands otherwise.

---

## Anti-Patterns

- **Caching mutable data without an invalidation plan** — works until the first time data changes under the cache, then silently serves stale content.
- **Cache-as-database** — treating the cache as authoritative storage. Caches are lossy by design (eviction, failures). Always have a durable source of truth behind.
- **L1 holding encoded bytes that L2 also holds** — wastes RAM with no speed benefit. L1 should hold decoded / computed forms; L2 holds encoded bytes.
- **Shared cache key collisions** — same key serving different users or contexts. Keys must include user + context + version where applicable.
- **Unbounded growth** — caches without eviction policies degrade into disk-fillers. Every cache needs a size cap and eviction rule.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Offline read | `User views previously-fetched [content type] when offline (verified by airplane mode test)` |
| Invalidation correctness | `Cache reflects user's own writes immediately after submission (verified by write-then-read integration test)` |
| Staleness bound | `Cached [content type] served at most [N] seconds stale (verified by timestamp inspection after TTL window)` |
| Bounded storage | `On-device cache does not exceed configured budget (verified by storage inspection after heavy usage)` |

### Architectural Decisions

```
Cache hierarchy: L1 memory + L2 disk on client. Rationale: consumer feed with image-heavy content; L1 keeps decoded bitmaps hot for scroll performance, L2 enables offline reads and survives restarts; no L3/CDN because content is user-specific and authenticated.

Invalidation: TTL on server-fetched data (short window for personalized feeds), explicit invalidation on user's own writes. Rationale: read-your-writes must be immediate; others' changes can lag by the TTL window.

Coherence: write-through at server, write-back at client. Rationale: client must stay responsive offline (write-back enables optimistic UI), server correctness is protected by write-through.
```

### Open Questions

```
TTL for feed content: 1 minute, 5 minutes, or 1 hour? Trade-off: shorter = more network load but fresher content; longer = offline reliability but feed may feel stale.

Offline cache retention: evict on storage pressure, or honor explicit user "keep available offline" flag? Trade-off: automatic eviction simplifies code; user-controlled pinning matches user expectations for content they explicitly care about.
```