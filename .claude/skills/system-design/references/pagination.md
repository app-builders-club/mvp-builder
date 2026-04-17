# Pagination Decision

Reference loaded for Data-heavy features (lists, feeds, search, dashboards with tabular data).

Implementation rules (envelope shape, `hasMore` convention, server max limit, opaque token encoding) live in backend rules. This file decides **which pagination strategy** to commit to in the spec.

---

## When Pagination Is a Decision

Pagination is always-on for collection endpoints. The decision is **which strategy**, not whether.

Skip this reference if the feature has no collection-returning endpoint.

---

## Three Strategies

| Strategy | Shape | Complexity under concurrent writes | Scale behavior |
|----------|-------|-------------------------------------|-----------------|
| **Offset** | `?page=N&limit=M` | Unstable — duplicates or skipped items when collection is modified mid-pagination | O(offset) per query — degrades with page depth |
| **Page-based** | `?page=N&per_page=M` | Same as offset (semantic duplicate) | Same as offset |
| **Cursor** | `?cursor=X&limit=M` | Stable — cursor points to a specific position; new items don't shift it | O(log N) regardless of page |

---

## Decision Tree

```
Is the collection active (items added/removed while users browse)?
├─ Yes → Cursor
└─ No (immutable historical data, admin dashboard, static reports)
    ├─ Does the UI need "page 5 of 47" style jumping?
    │   ├─ Yes → Page-based (accept the trade-off)
    │   └─ No → Cursor (future-proofs against becoming active later)
    └─ Tiny dataset (<1000 items ever)?
        └─ Offset acceptable (performance non-issue, UI simpler)
```

### Shortcuts

- Feeds, messages, notifications, search results, user-generated content → **Cursor**
- Admin tools with small stable datasets → **Offset** acceptable
- Public APIs → **Cursor** (consumers will hit problems you never anticipated)
- Anything that might grow unpredictably → **Cursor**

---

## Trade-offs to Surface in Decisions

When recommending **cursor**, name what it costs:
- No arbitrary page jumping ("go to page 47")
- No natural total count ("showing 50 of 12,845")
- Reverse traversal needs explicit support

When recommending **offset**, name what it costs:
- Breaks under concurrent writes (duplicates / skips)
- Degrades at high offsets
- Migrating later is expensive (dual-scheme coexistence)

---

## Anti-Patterns

- **Embedding unbounded collections** — `GET /boards` returning boards with all cards embedded. Child collection has no pagination path. Split into separate paginated endpoints.
- **Unstable sort order** — sorting by "popularity" that fluctuates second-to-second breaks cursor assumptions. Fix sort or snapshot it.
- **Pagination mixed across endpoints** — one API using cursor, another offset, another page-based. Pick one scheme for the product.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Pagination present | `Collection endpoints paginate results using cursor-based approach (verified by integration test walking paginated results to completion)` |
| Stable under writes | `Pagination produces no duplicates or skipped items when collection is modified during traversal (verified by concurrent write integration test)` |
| Bounded response | `Paginated endpoints enforce server-side maximum limit per page (verified by request with oversized limit receiving clamped response)` |
| Deterministic order | `Items in paginated responses appear in deterministic order with stable tie-breaking (verified by test with items sharing primary sort value)` |

### Architectural Decisions

```
Pagination strategy: cursor-based. Rationale: collection is active (new items added during user traversal); offset would cause duplicates or skipped items and degrades at depth.

Pagination strategy: offset. Rationale: admin dashboard on immutable historical records; page jumping is a UX requirement; dataset size keeps offset performance acceptable.
```

### Open Questions

```
Page size default: 25, 50, or 100? Trade-off: smaller pages = more round-trips but faster initial render; larger pages = fewer round-trips but slower first paint.

Total count display: required in UI? Trade-off: "showing N of M" requires expensive COUNT queries on active tables; "load more" pattern avoids it entirely.
```