# Pagination Strategy

Reference for designing paginated endpoints. Loaded when triage identifies Data-heavy features (lists, feeds, search results, dashboards with tabular data) or when discussion involves API design for collections.

This reference is grounded in Slack's published evolution of their pagination API (no pagination → offset → cursor-based), with concrete failure modes observed at scale.

---

## Paginate Everything

The single most important decision: if an endpoint returns a list, paginate it from day one.

Slack's explicit recommendation after years of evolving their API:

> "If you're wondering whether or not you should paginate an endpoint that returns a list of data, no matter how small the dataset seems, we recommend you do."

Reasoning:
- Collections you assume will stay small tend not to. Slack's `channels.list` was designed for teams under a few hundred users; teams grew to tens of thousands.
- Retrofitting pagination to a previously-unpaginated endpoint is a breaking change or forces supporting both forever (expensive).
- Rate limiting and caching work better on bounded responses.

Cost of early pagination is trivial (one extra parameter, one extra piece of response metadata). Cost of late pagination is immense. Always paginate.

---

## Three Strategies

Three canonical pagination approaches. Each has a clear zone of applicability.

### Offset Pagination

```
GET /items?page=3&count=50
```

Client asks for page N of items.

**How it works under the hood:**
```sql
SELECT * FROM items ORDER BY created_at DESC LIMIT 50 OFFSET 100
```

**Why it fails at scale:**

1. **Performance degrades with offset size.** Database must read `offset + count` rows from disk, then discard `offset` rows to return `count`. At offset=100000, database reads 100050 rows to return 50. O(offset) per query.

2. **Page window is unreliable with concurrent writes.** If items are being added while user paginates:
   - User fetches page 1 (items 1–10)
   - 10 new items added
   - User fetches page 2 (now shows items 1–10 again — duplicates)
   - Or the reverse: items deleted between pages, user skips entries

   This is not a theoretical issue. Slack documented it for messaging — between fetching page 1 and page 2, new messages in the channel make page 2 return items already on page 1.

**When offset pagination is acceptable:**
- Admin tools and internal dashboards with moderate dataset size
- Reports on historical data (immutable — write concurrency isn't a concern)
- Anywhere user will never reach high offsets in practice

**When to avoid:**
- Any active collection (feeds, messages, notifications)
- Datasets that may grow unpredictably
- Public APIs (consumers will hit problems you never anticipated)

### Page-Based Pagination

```
GET /items?page=3&per_page=50
```

Semantically identical to offset pagination — `page=3, per_page=50` means `offset=100, count=50`. Same failure modes.

**Only justified when** UI genuinely presents "Page 3 of 47" with clickable page numbers. Even then, cursor pagination can back a page-numbered UI by caching cursor-per-page server-side.

### Cursor-Based Pagination

```
GET /items?cursor=dXNlcjpVMEc5V0ZYTlo=&limit=50
```

Client passes an **opaque cursor** pointing to a specific item. Server returns next batch plus a new cursor.

**How it works under the hood:**
```sql
SELECT * FROM items WHERE created_at < <cursor_timestamp> ORDER BY created_at DESC LIMIT 50
```

Or, for tie-breaking on duplicate timestamps:
```sql
SELECT * FROM items
WHERE (created_at, id) < (<cursor_ts>, <cursor_id>)
ORDER BY created_at DESC, id DESC
LIMIT 50
```

**Why cursor wins:**

1. **O(log N) performance regardless of page.** Index lookup on sorted column, no offset scan. Performance identical for page 1 and page 10000.

2. **Stable under concurrent writes.** Cursor identifies a specific position — new items inserted elsewhere don't shift the position. User never sees duplicates or skipped items.

3. **Opaque cursor = backend flexibility.** Client treats cursor as opaque string. Server decides what to encode: timestamp, ID, composite key, Base64 blob with internal state. Backend can change cursor scheme without breaking clients.

**Why cursor loses in narrow cases:**

- **No jumping to arbitrary page.** Can't "go to page 47" — must iterate from beginning.
- **No total count naturally.** Some cursor implementations can't cheaply provide "showing 50 of 12,845 results."
- **Reverse traversal requires explicit support.** Unlike offset where negative math works, cursors need a direction parameter.

---

## Opaque Cursor Design

The opaque-cursor principle is worth dwelling on. It's the pattern that gave Slack flexibility to evolve.

### The Principle

Client treats cursor as **an opaque string**. Does not parse, inspect, or construct cursors. Only receives from server and sends back unchanged.

Server decides what the cursor actually contains:
- Simple timestamp + ID tuple (Base64-encoded)
- Database sequence number
- ElasticSearch `search_after` token
- Cursor scheme unique per endpoint
- Signed/encrypted for tamper protection

Client doesn't care. Server can change the encoding tomorrow without client updates.

### Typical Implementation

```json
// Response
{
  "items": [ ... ],
  "response_metadata": {
    "next_cursor": "dXNlcjpXMDdRQ1JQQTQ="
  }
}
```

Decoded cursor (server-side only): `user:W07QCRPA4` — means "continue from user with ID W07QCRPA4."

Empty cursor string (`"next_cursor": ""`) = no more results.

### Slack's Simplification Over Relay

The GraphQL Relay spec defines cursor pagination with `edges`, `nodes`, `pageInfo`, `hasNextPage`, `hasPreviousPage`, `startCursor`, `endCursor`, per-item cursors, and bidirectional traversal.

Slack deliberately simplified:
- Single `next_cursor` in response metadata (no per-item cursors)
- Only forward traversal (no `hasPreviousPage`, no reverse)
- No `edges`/`nodes` wrapper around each item
- Just `items: [...]` and `next_cursor: "..."`

**Trade-off:** lost bidirectional traversal and per-item cursors. Gained: much simpler implementation and response shape.

**When to apply Slack's simplification:** most APIs. Bidirectional traversal is rarely needed; when it is, add a `direction` parameter.

### Backward Compatibility

If current API uses offset pagination and you want to move to cursor: cursor can be added **alongside** offset. Server accepts either parameter. Gradually deprecate offset.

But note Slack's warning: "we could never fully transition any endpoint that had used the legacy pagination, because we did not want to break any apps that were already using the older request format. For those endpoints, the old and new pagination had to exist side-by-side."

Dual-scheme coexistence has real cost. Avoid it by paginating correctly from the start.

---

## Request and Response Shape

Recommended shape for cursor pagination in REST APIs:

**Request parameters:**
- `cursor` — opaque string, omitted on first request
- `limit` — max results per page (enforce server-side upper bound, default reasonable value)

**Response structure:**
```json
{
  "items": [ { ... }, { ... } ],
  "response_metadata": {
    "next_cursor": "dXNlcjpXMDdRQ1JQQTQ="
  }
}
```

Or (common alternative):
```json
{
  "data": [ ... ],
  "pagination": {
    "next_cursor": "dXNlcjpXMDdRQ1JQQTQ=",
    "has_more": true
  }
}
```

Pick one shape, use it everywhere. Consistency matters more than which specific shape.

### Server-Side Limits

- Enforce maximum `limit` (typically 100 or 200). Client requesting `limit=10000` should get 200 back, not a 500.
- Default `limit` when omitted (25, 50, or 100 typical).
- Return descriptive error if cursor is malformed (not just empty results).

### Empty Cursor Convention

Slack's choice: empty string cursor (`"next_cursor": ""`) = end of results.

Alternative: omit the cursor field entirely, or use `null`, or `"has_more": false`.

Any convention works. Document it clearly.

---

## Sort Ordering

Pagination requires a deterministic sort order.

### The Tie-Breaker Problem

Sort by `created_at DESC` alone fails when multiple items share a timestamp (bulk inserts, imports, same-second creations). Cursor "continue after timestamp T" leaves ambiguity — which items with timestamp T should appear where?

**Solution:** always sort by `(primary_field, id)` as a composite. The ID provides tie-breaking.

```sql
ORDER BY created_at DESC, id DESC
```

Cursor encodes both: `(created_at, id)` of the last item returned.

### Sort Options and Cursor Invariance

If an endpoint supports multiple sort options (`sort=newest`, `sort=relevance`, `sort=popular`), the cursor must encode the sort scheme used. Changing sort mid-pagination should reject the cursor (error, not silent switch).

Opaque cursor makes this trivial — include sort mode in the encoded cursor payload.

### Stable Sort Requirement

Sort order must be stable over time. Sort by "popularity" that fluctuates second-to-second breaks cursor assumptions — the item at cursor position may have moved or no longer be at that rank.

If unstable sorting is required (user rank, trending), cursor pagination still works but accept that window may shift. Alternative: snapshot the sort order at first request, identify snapshot in cursor, use snapshot for subsequent pages.

---

## Common Pitfalls

### Nested Big Collections

`GET /boards` returns boards, and each board embeds all its cards. Pagination on boards works; pagination on cards-within-board is impossible without restructure.

**Slack's case:** `channels.list` returned channels with all members embedded. Teams with 10k+ users broke it. Split into `conversations.list` + `conversations.members` — two separate paginated endpoints.

**Mitigation:** never embed a collection that can grow unboundedly inside another collection. Return IDs or minimal summaries; require separate request for the nested collection.

### Cursor Leakage into Client Logic

Client parses the cursor to extract "last item ID" or "page number." Server changes cursor encoding. Client breaks.

**Mitigation:** treat cursor as truly opaque. If client needs the information in the cursor, expose it separately in the response (e.g., `last_seen_timestamp`).

### Missing Tie-Breaker

`ORDER BY created_at DESC` without secondary sort. Two items with identical timestamps — user may see one, miss the other, or see the same item twice.

**Mitigation:** always add ID as tie-breaker. `ORDER BY created_at DESC, id DESC`.

### Unbounded Limit

`GET /items?limit=1000000` — server attempts to return a million rows. Either times out or exhausts memory.

**Mitigation:** enforce maximum limit server-side. Return clamped result with a warning, or reject with `400 Bad Request`.

### Cursor-Based Deep Linking

Cursor is opaque — not suitable for URLs users bookmark. "Go to page 47" doesn't work with cursors.

**Mitigation:** if UI genuinely needs deep links to specific positions (rare), augment cursor with stable deep-linkable identifiers (item ID, timestamp). Most UIs don't need this.

### Over-Fetching to Show Total Count

"Showing 50 of 12,845 items" requires a separate `COUNT(*)` query that's often slow on large tables.

**Mitigation:** show approximate counts ("more than 10k items"), or drop total count entirely (GitHub, Slack, many others don't show totals on large collections). If accurate count required, cache it.

### Different Pagination Schemes Across Endpoints

`users.list` uses cursor, `messages.list` uses offset, `channels.list` uses page-based. Clients must learn three patterns.

**Mitigation:** single pagination scheme across the API. Document it as a cross-cutting concern in API guidelines. New endpoints follow the convention; old endpoints get migrated or deprecated.

---

## Required Behaviors — Templates for Skill Output

When skill synthesizes output for a feature with paginated collections:

| Behavior | Template |
|----------|----------|
| Pagination presence | `Endpoints returning collections paginate results using cursor-based approach (verified by integration test walking paginated results to completion)` |
| Stable under writes | `Pagination produces no duplicates or skipped items when collection is modified during traversal (verified by concurrent write integration test)` |
| Bounded response size | `Paginated endpoints enforce server-side maximum limit of [N] items per page (verified by request with oversized limit receiving clamped response)` |
| Empty-cursor signal | `Endpoint signals end of results with empty cursor string (verified by fetching last page and confirming cursor convention)` |
| Deterministic ordering | `Items in paginated responses appear in deterministic order with tie-breaking by stable ID (verified by test with items sharing primary sort value)` |
| Malformed cursor handling | `Invalid or tampered cursor returns descriptive error, not empty results or server error (verified by test with malformed cursor input)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions for a feature with paginated collections:

```
Pagination strategy: cursor-based with opaque Base64-encoded tokens. Rationale: collection is active (new items added during traversal), offset pagination would cause duplicates or skipped items; cursor gives O(log N) performance regardless of page depth and stable results under writes. Source: Slack "Evolving API Pagination."

Cursor format: opaque to client, server-defined internally. Cursor encodes composite sort key (primary field + stable ID) for tie-breaking. Rationale: opaque cursor lets server change underlying scheme per endpoint without breaking clients. Source: Slack "Evolving API Pagination."

Pagination parameters: cursor + limit only (no explicit page number, no backward traversal). Rationale: Slack's simplified scheme over Relay — most use cases don't need bidirectional traversal, simpler shape reduces client error. Source: Slack "Evolving API Pagination."

Sort ordering: ORDER BY created_at DESC, id DESC. Rationale: timestamp alone creates ties on bulk inserts; ID tie-breaker ensures deterministic ordering and cursor stability.

Limit enforcement: server-side max of 100 items per page, default 25. Rationale: prevents unbounded response sizes from malformed clients or runaway scripts. Source: Slack API design principles.

Empty cursor convention: empty string next_cursor signals end of results. Rationale: consistent with Slack convention, simple check for clients.

Total count strategy: omit total count from list responses. Rationale: accurate counts require expensive COUNT(*) queries on active tables; most UIs work fine with "load more" pattern and don't need totals.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **Any list or collection endpoint** → cursor-based pagination default
- **Admin tool with small, stable dataset** → offset pagination acceptable (document the limitation)
- **Historical reports on immutable data** → offset or page-based fine (no concurrent writes)
- **Messaging / feeds / active timelines** → cursor required (stability under writes is critical)
- **Search results with rapidly-changing ranking** → cursor with snapshot identifier, or accept window shift
- **Endpoint needs to show "page 5 of 47" in UI** → cursor pagination backed by cached page-number→cursor map on server, or accept that requirement means offset (note trade-off explicitly)

---

## Invariants

- Every list endpoint is paginated from day one, regardless of expected collection size
- Cursors are opaque strings — server encodes what it needs, client treats as untouched
- Sort ordering includes a stable tie-breaker (ID is sufficient)
- Server enforces maximum page size
- Pagination scheme is consistent across the entire API — one convention, documented
- Nested collections that can grow unboundedly are split into separate endpoints, not embedded