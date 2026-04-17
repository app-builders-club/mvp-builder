# Caching Strategy

Reference for designing caching at client and server layers. Loaded when triage identifies Data-heavy, Media-heavy, Offline-critical, or Low-bandwidth features.

Grounded in Instagram's ig-disk-cache (open-sourced fault-tolerant Android disk cache with journal-based tracking), Android's documented bitmap caching patterns, and standard HTTP caching mechanisms.

---

## Cache Hierarchy

Most caching decisions involve a three-layer hierarchy. Each layer has different characteristics, and the right decision for one layer rarely fits another.

| Layer | Location | Speed | Capacity | Volatility |
|-------|----------|-------|----------|------------|
| **L1 — Memory** | App RAM | Nanoseconds | MB | Lost on app termination |
| **L2 — Disk** | Local storage | Milliseconds | Hundreds of MB | Persists until eviction or uninstall |
| **L3 — Network (CDN/server)** | Edge servers, origin | 10s-100s of ms | Effectively unlimited | Controlled by HTTP headers |

Design rule: check each layer in order, write to each layer on miss. Reading is "memory → disk → network"; writing (populating) is "network → disk → memory."

The goal of caching is not to eliminate network requests — it's to make each layer's hit rate high enough that network requests become a fallback, not the default.

---

## L1: Memory Cache

In-process cache of frequently-accessed data. Fastest, most constrained.

### What Belongs in Memory Cache

- **Decoded bitmaps/images** — decoded bitmaps can be 10-50× the size of the encoded JPEG. Decoding is expensive. Cache after first decode.
- **Frequently-rendered view models** — rendering UI from raw server data may require parsing, computation, formatting. Cache the rendered model.
- **User-specific computed data** — permissions, preferences, derived state that requires computation.
- **API responses marked as cacheable** — within a session, responses where staleness is tolerable.

### What Doesn't Belong

- **Raw response bodies** — if L2 disk cache exists, memory holding encoded JSON that's already on disk wastes RAM for no speed benefit.
- **Large binary data** — videos, audio, high-resolution raw images. Keep those on disk; decode on demand.
- **Data that changes rapidly** — cache invalidation on every change burns more CPU than the cache saves.

### Memory Cache Sizing

The dominant memory cost for most apps is **decoded bitmaps**, not encoded bytes. A 100KB JPEG decoded to a 1080×1920 ARGB_8888 bitmap is approximately 8MB in memory — 80× larger.

Heuristic for image-heavy apps (photo feeds, galleries, product catalogs):
- **~20% of available app memory** for bitmap cache — enough for smooth scrolling, leaves room for UI and business logic
- Lower (10%) if the app has other memory-intensive features (video, ML)
- Higher (30%) only if bitmaps dominate app memory usage

For non-bitmap data (view models, parsed responses):
- **Fixed object count** rather than byte size — typical LruCache configured for ~100-500 entries
- Evict on count, not memory pressure — count is easier to reason about

### LRU as Default Eviction

The LRU (Least Recently Used) strategy dominates memory caching for a reason: access recency is the strongest predictor of future access in most UI patterns.

- Android: `LruCache` class
- iOS: `NSCache` (with automatic memory-pressure eviction) or custom dictionary-backed LRU
- Both evict least-recently-accessed entries when size limits exceeded

Alternative strategies (LFU — Least Frequently Used, TTL — Time To Live) rarely beat LRU for client-side caches. Consider them only with specific access patterns (analytics dashboards with recurring queries favor LFU; data with known freshness windows favors TTL).

### Thread Safety

Memory caches are accessed from multiple threads — UI thread reads, background thread writes on fetch completion. `LruCache` on Android is thread-safe; iOS `NSCache` is thread-safe. Custom implementations require explicit synchronization.

---

## L2: Disk Cache

Persistent local cache. Survives app termination, restarts, occasional eviction.

### Instagram's ig-disk-cache — Reference Implementation

Meta open-sourced Instagram's disk cache library. The design choices are worth documenting as ground truth for production-grade disk caching.

**Journal-based tracking:**
- Every cache entry's state recorded in a journal file
- Two states per key: CLEAN (readable) and DIRTY (being written)
- Example journal entries:
  ```
  CLEAN 3400330d1dfc7f3f7f4b8d4d803dfcf6 832
  DIRTY 335c4c6028171cfddfbaae1a9c313c52
  CLEAN 335c4c6028171cfddfbaae1a9c313c52 3934
  DIRTY 3400330d1dfc7f3f7f4b8d4d803dfcf6
  ```
- Crash mid-write? On next startup, DIRTY entries without corresponding CLEAN are discarded
- No partial entries ever visible to readers

**Fault tolerance:**
- Cache directory unavailable → constructor returns stub instance, operations no-op silently
- Invalid cache size → stub instance
- Write fails mid-stream → partial change silently discarded, stale entry (if existed) also removed
- The cache "always works" from the caller's perspective; failures degrade gracefully

**Explicit commit/abort:**
- Write path: `edit(key)` → `OutputStream` → `commit()` or `abort()`
- `commit()` marks entry CLEAN in journal
- `abort()` or exception path leaves nothing committed
- Concurrent `edit(same_key)` throws `IllegalStateException` — race condition surfaced to developer

**Non-UI thread enforcement:**
- Assertions prevent disk I/O on UI thread
- Constructor itself non-UI-thread — building journal index is work

**Soft limits:**
- Cache limits (size + file count) are not strict
- Can temporarily exceed limits while LRU eviction runs
- Strict limits would force expensive synchronous eviction on every write

**Cache key validation:**
- Keys must match `[a-z0-9_-]{1,120}`
- Filesystem-safe characters only
- Max length ensures safe file naming on all filesystems

### Disk Cache Sizing

- **Image/media-heavy apps**: 100–500MB typical. Instagram-style feeds with weeks of scrollback benefit from larger caches.
- **Structured data caches** (offline app data): 10–50MB typically sufficient
- **Check available storage before sizing** — allocating 500MB on a 16GB device with 500MB free is hostile

### Cache Location

- **User Data (Documents)** — never. Disk cache is not user data, doesn't belong in backup, may be purged safely.
- **Caches directory** (iOS: `Library/Caches`, Android: `cacheDir`) — correct location. OS may purge on storage pressure.
- **Tmp directory** — too aggressive. OS may purge during app execution.

OS-managed caches directories integrate with system storage pressure handling — when device is low on storage, OS evicts caches apps-side. Working with this mechanism is better than fighting it.

### Background Thread Discipline

Disk I/O latency is unpredictable — tens to hundreds of milliseconds for a miss, occasionally seconds on saturated storage. Never block UI on disk reads.

Pattern:
1. UI thread checks memory cache synchronously
2. Miss → dispatch disk read on background thread
3. Show loading state in UI while reading
4. On completion, populate memory cache and update UI

---

## L3: Network/HTTP Caching

Server-controlled caching via HTTP headers. Works in browsers, CDNs, reverse proxies, mobile clients that respect HTTP semantics.

### Essential Headers

**Cache-Control** — the core directive.

- `Cache-Control: public, max-age=3600` — cacheable by any layer for 1 hour
- `Cache-Control: private, max-age=60` — cacheable only by end client, 1 minute
- `Cache-Control: no-cache` — must revalidate with origin before using (can still be stored)
- `Cache-Control: no-store` — never cache anywhere
- `Cache-Control: immutable` — content won't change; don't even revalidate (use for fingerprinted assets)

**ETag** — content-based validator.

- Server sends `ETag: "abc123"` with response
- Client stores, sends back as `If-None-Match: "abc123"` on next request
- Server returns `304 Not Modified` with empty body if still valid, or new content if changed

**Last-Modified** — timestamp-based validator.

- Alternative to ETag when content-based hashing is expensive
- Client sends `If-Modified-Since: <timestamp>`
- Server returns `304` or new content

**Vary** — identifies cache key variations.

- `Vary: Accept-Encoding` — different cached entries per compression type
- `Vary: Authorization` — different cached entries per user (typically use `Cache-Control: private` instead)

### When HTTP Caching Works Well

- Public data served to many users (homepage content, product catalogs, images)
- Immutable assets with content-hashed URLs (`app-abc123.js`, `image-def456.png`)
- CDN-friendly endpoints that benefit from edge caching
- Clients that respect HTTP semantics (browsers, well-behaved HTTP libraries)

### When HTTP Caching Falls Short

- **Mobile clients that don't respect HTTP semantics** — some HTTP libraries ignore Cache-Control or have broken implementations. Test behavior.
- **User-specific data** — `private` caching only helps that one user on that one device
- **Data with complex freshness requirements** — "cache for 1 hour, but invalidate when user posts something" — HTTP caching doesn't express this. Need application-level invalidation.
- **GraphQL** — all POST, HTTP cache doesn't apply naturally. Requires GraphQL-specific caching (Apollo client cache, etc.)

### CDN Integration

For public assets (images, videos, CSS, JS):
- CDN caches at edge locations globally
- Cache-Control headers drive CDN behavior
- `immutable` + long max-age for fingerprinted assets: `Cache-Control: public, max-age=31536000, immutable`
- Short max-age + ETag for content that rarely changes but might: `Cache-Control: public, max-age=60`
- CDN purging APIs for explicit invalidation (use sparingly)

---

## Eviction Strategies

### LRU (Least Recently Used) — Default

Track access time on every read/write. Evict the entry with the oldest access time.

- **When it works:** access patterns where recent access predicts future access (most UI-driven caches)
- **When it fails:** scan patterns that touch everything once (displaces useful entries with one-time reads)

### LFU (Least Frequently Used)

Track access count. Evict least-frequently-accessed.

- **When it works:** analytics dashboards with recurring queries, recommendation systems
- **Overhead:** counter per entry, increment cost on every access

### TTL (Time To Live)

Every entry has expiration timestamp. Evict expired entries.

- **When it works:** data with known freshness window (session tokens, feature flags)
- **Combine with LRU:** TTL for freshness + LRU for capacity

### Size-Bounded vs Count-Bounded

- **Size-bounded** for bitmap/media caches — bytes are the scarce resource
- **Count-bounded** for structured data caches — entry count is easier to reason about, entries similar in size
- **Both** for robustness — first trigger wins

---

## Cache Invalidation

"There are two hard things in computer science: cache invalidation and naming things." — Phil Karlton

Invalidation strategies, ordered from simplest to most sophisticated:

### Strategy A: Time-Based Expiry (TTL)

Every entry has a TTL. Expires on time elapsed. No explicit invalidation.

**Pros:** trivial, no coordination needed.
**Cons:** users see stale data until expiry.
**When to apply:** data where eventual freshness is acceptable (feed listings, search results).

### Strategy B: Event-Driven Invalidation

On write operation, explicitly invalidate cache entries affected.

- User updates profile → invalidate profile cache entries
- Post created → invalidate relevant feed caches

**Pros:** fresh data immediately after writes.
**Cons:** requires knowing what caches depend on what writes. Mistakes cause stale data.
**When to apply:** user-perceivable writes where stale data is jarring (user's own profile, just-sent messages).

### Strategy C: Write-Through

Writes go to cache and underlying store simultaneously. Cache never stale (by definition).

**Pros:** zero stale reads.
**Cons:** write latency = cache + store. More complex than simple read-through caching.
**When to apply:** when consistency matters and write volume is low.

### Strategy D: Cache Aside / Read-Through

Reads check cache, miss triggers fetch + cache populate. Writes update store and invalidate cache entry.

**Pros:** simple, cache only contains what's been accessed.
**Cons:** first read after write always a miss (sometimes acceptable, sometimes not).
**When to apply:** default for most caches.

### Decision Tree

1. Can users tolerate stale data for minutes? → TTL
2. User-perceivable writes need immediate freshness? → event-driven invalidation + TTL backup
3. Strong consistency required? → write-through or skip caching
4. Cache layer only for read optimization? → read-through (cache-aside)

---

## Prefetching

Speculatively loading data before the user requests it, to eliminate perceived latency.

### When Prefetching Helps

- **Next-page prefetch**: user scrolls list, prefetch page N+1 before user reaches end
- **Related-content prefetch**: user views product, prefetch commonly-viewed-next products
- **Navigation prefetch**: user hovers over link (web), prefetch destination
- **Login prefetch**: user opens app, prefetch home screen data before login completes (if possible)

### Prefetch Cost

- **Bandwidth**: prefetched data not used is wasted bytes. On cellular, users pay.
- **Server load**: prefetching N× the normal request volume if hit rate isn't high.
- **Battery**: mobile radio wakeups for speculative requests.

### Prefetch Heuristics

- **Only prefetch on WiFi** (mobile apps) — respect cellular data
- **Prefetch only what's likely to be used** — next page when user at 70%+ through current page, not when they just opened it
- **Limit concurrent prefetches** — 1-2 parallel, don't saturate the connection
- **Lower priority than interactive requests** — prefetch must not delay user-initiated loads

### When Prefetching Hurts

- **Unpredictable navigation** — user jumps around randomly; prefetches miss
- **Already-fast network** — prefetching saves 50ms on a 100ms request; not worth the complexity
- **Battery-constrained scenarios** — every radio wake costs battery; speculative requests compound

---

## Cache Stampede Protection

When a popular cache entry expires, every subsequent request misses and hits the backend simultaneously — "thundering herd." Backend overloads.

### Probabilistic Early Expiration

Instead of all clients seeing "expired" at the same moment, stagger expiration:

- Entry has TTL of 3600s
- Clients probabilistically treat entry as expired before the TTL, with probability increasing as TTL approaches
- First clients to refresh do so early, spreading load
- Others still hit cache until hard expiry

### Single-Flight Pattern (Server-Side)

On cache miss, if multiple concurrent requests arrive for the same key:
- First request proceeds to backend
- Subsequent requests wait for first request to complete and populate cache
- All requests return the same cached value

Implementations: Go's `singleflight`, Python's `asyncio.Event` coordination.

### Request Coalescing (Client-Side)

Same pattern, client side: if multiple UI components request the same data simultaneously, the HTTP layer issues one request and shares the result.

### When Stampede Protection Matters

- High-traffic public caches (product pages, feeds)
- Expensive backend operations (complex joins, aggregations, external API calls)
- At MVP scale, often not needed — premature optimization before real traffic

---

## Common Pitfalls

### Caching Without Sizing

Unlimited cache grows until device runs out of memory or storage. App crashes or evicted by OS.

**Mitigation:** every cache has explicit size limits. Monitor real-world usage to calibrate.

### Disk I/O on UI Thread

"Quick check if it's cached" blocks rendering. 100ms disk hit = dropped frames.

**Mitigation:** memory cache on UI thread, disk cache always on background thread. Loading states in UI during disk reads.

### No Invalidation Strategy

Cache populated, never updated. User sees stale data indefinitely.

**Mitigation:** every cache has an explicit invalidation strategy documented. TTL at minimum.

### Caching User-Specific Data as Public

Endpoint returns data based on auth token; cache layer treats URL as key. Different users get each other's data.

**Mitigation:** `Cache-Control: private` for user-specific responses. Or include user ID in cache key. Or don't cache at all.

### Ignoring Storage Pressure

App caches hundreds of MB indefinitely. User runs out of device storage. OS purges cache (good) or user uninstalls app (bad).

**Mitigation:** use OS cache directories (`cacheDir` / `Library/Caches`). Check available storage before sizing. Respond to OS low-memory notifications.

### Premature Cache Optimization

Team adds Redis, memcached, CDN, edge caching for an app with 100 users. Infrastructure cost + complexity dwarf any benefit.

**Mitigation:** measure before caching. MVPs typically need only HTTP caching + client-side memory/disk caches. Add server-side caching when profiling proves need.

### Stale Read After Write

User updates profile, reload shows old data. Cache wasn't invalidated on write.

**Mitigation:** write path invalidates relevant cache entries. Or write-through cache. Or skip cache for "just wrote" data (read-your-writes pattern).

### Crash-Unsafe Disk Cache

Write partially completes, app crashes, disk cache contains corrupted entry. Next read returns garbage or crashes.

**Mitigation:** journal-based caching (Instagram ig-disk-cache pattern). Writes commit atomically. Dirty entries discarded on startup.

---

## Required Behaviors — Templates for Skill Output

When skill produces output for a caching-relevant feature:

| Behavior | Template |
|----------|----------|
| Memory cache warm | `Recently-viewed [entities] load from memory within [N]ms (verified by cache-hit performance test)` |
| Disk cache persistence | `Previously-loaded [entities] available after app restart without network (verified by airplane-mode-after-restart test)` |
| HTTP cache respect | `Unchanged resources return 304 Not Modified on revalidation (verified by HTTP integration test with If-None-Match)` |
| Cache size bounds | `Disk cache stays under [N]MB through normal usage (verified by storage profiling)` |
| UI thread safety | `Cache operations do not block UI thread (verified by frame-drop profiling during cache access)` |
| Crash safety | `Interrupted cache writes do not corrupt cache on next launch (verified by crash-during-write test)` |
| Invalidation correctness | `User sees updated [entity] immediately after modification, not stale cached version (verified by write-then-read test)` |
| Prefetch discipline | `Prefetching happens only on WiFi (verified by cellular network simulation)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions involving caching:

```
Cache hierarchy: L1 memory (LRU, ~20% of available RAM for decoded bitmaps) + L2 disk (journal-based, 250MB cap, LRU eviction) + L3 HTTP cache (standard Cache-Control headers). Rationale: decoded bitmaps dominate memory cost for image-heavy apps; disk persistence survives app restart; HTTP caching leverages CDN and browser layers without application complexity. Source: Instagram ig-disk-cache pattern for L2 design.

Disk cache implementation: journal-based with CLEAN/DIRTY states per entry, explicit commit/abort, fault-tolerant degradation. Rationale: production disk caches must survive crashes mid-write, filesystem errors, and concurrent access without corruption. Source: Instagram ig-disk-cache open-source library.

Cache invalidation: TTL-based with 1-hour expiry for feed content, event-driven invalidation for user's own mutations. Rationale: stale feed content is acceptable for minutes; stale own-data is jarring and breaks read-your-writes expectation.

HTTP caching: Cache-Control: public, max-age=60 for content endpoints; Cache-Control: private, max-age=0 for user-specific; immutable + long max-age for fingerprinted static assets. Rationale: tiered freshness matches data characteristics; immutable saves CDN revalidation on assets guaranteed not to change.

Prefetching: next-page prefetch when user scrolls past 70% of current list, WiFi-only, lower priority than interactive requests. Rationale: preserves cellular data and battery while eliminating perceived latency on scroll.

Cache sizing: L1 memory sized to 20% of available app memory (approximately 100-200MB on modern mobile); L2 disk at 250MB hard cap. Rationale: L1 sized for hot working set; L2 sized to survive week-long offline scenarios without exhausting storage.

Eviction strategy: LRU for both L1 and L2. Rationale: recency is the strongest predictor of re-access in UI-driven caches; LFU and TTL don't improve hit rate for typical feed/list access patterns.

Stampede protection: single-flight request coalescing on cache miss for expensive backend operations. Rationale: thundering herd on popular cache entries overwhelms backend during recovery. Single-flight shares one backend request across concurrent miss requests.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **User described image-heavy feature (feed, gallery, product catalog)** → L1 bitmap cache + L2 disk cache, cite Instagram ig-disk-cache pattern
- **User described data-heavy feature without media** → L1 view-model cache + HTTP caching, disk cache only if offline-capable
- **User described "data that may be stale briefly"** → TTL invalidation, 60s-1h depending on data type
- **User described "data that must be fresh after own writes"** → event-driven invalidation on write path
- **User described emerging-markets or low-bandwidth target** → aggressive L2 disk cache, offline-first pattern, prefetching off by default
- **User described public API serving many users** → HTTP caching + CDN, server-side cache layer only if profiling justifies
- **User at MVP scale** → client-side caches (memory + disk + HTTP) only, defer server-side caching (Redis, memcached) until traffic justifies

---

## Invariants

- Every cache has explicit size bounds and eviction strategy
- Every cache has an invalidation strategy — TTL at minimum, event-driven or write-through where freshness matters
- Disk I/O never runs on UI thread
- Disk caches use OS-managed cache directories (respect storage pressure)
- Disk caches are crash-safe through journaling or equivalent atomic-commit pattern
- User-specific data is cached with user-identified keys or `private` HTTP directive
- Cache layers are added based on measured performance need, not speculative optimization