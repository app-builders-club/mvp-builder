# Media Upload Strategy

Reference loaded for Media-heavy features (photo/video upload, streaming, large file transfer).

Implementation rules (specific MB thresholds, chunk size, session persistence, progress indication, hash algorithm) live in mobile rules. This file decides **upload strategy and integrity model** to commit to in the spec.

---

## When Upload Strategy Is a Decision

Decide when the feature involves:
- Client-side origination of media (camera, import, recording)
- File transfer over unreliable networks (mobile, emerging markets)
- Content that must survive transfer interruptions
- Large enough payloads that single-shot upload risks timeout

Skip when the feature only downloads media, streams server-originated content, or handles files small enough for single-request transfer.

---

## Strategy Matrix

| Strategy | Fit | Trade-off |
|----------|-----|-----------|
| **Single-request upload** | Small files, reliable network, fire-and-forget OK | Entire upload fails on any interruption; no resume |
| **Chunked upload (no resume)** | Large files on reliable networks | Chunks fail together; no better than single-request under interruption |
| **Resumable upload (chunked + session)** | Large files on unreliable networks, mobile clients | More protocol surface; server must track session state |
| **Direct-to-storage with signed URLs** | Any size, offload bandwidth from app servers | Client needs short-lived credentials; finalize step still requires app server |

---

## Decision Tree

```
Will files exceed the "small file" threshold defined in mobile rules?
├─ Never → Single-request upload
└─ Sometimes or always
    ├─ Network reliability assumed (desktop, corporate WiFi)?
    │   ├─ Yes → Chunked upload (no resume necessary)
    │   └─ No → Resumable upload
    └─ Is app server in the upload path critical, or can storage accept direct writes?
        ├─ Critical (validation, virus scan, transcoding pipeline) → Upload through app server
        └─ Not critical (object storage can receive + validate on finalize) → Direct-to-storage with signed URLs
```

### Shortcuts

- Mobile clients + user-generated media → **Resumable + chunked**
- Web clients + corporate users on reliable networks → **Chunked** acceptable
- High-throughput media pipeline (video platforms) → **Direct-to-storage** almost always

---

## Integrity Model

Three questions to answer:

**1. Does the server verify content integrity?**

- Client computes content hash before upload
- Server validates hash after assembly
- Mismatch → reject and return a recoverable error

Default: **yes**, for anything larger than a thumbnail.

**2. Does the server deduplicate by content hash?**

- Before accepting upload, server checks if the hash already exists
- Existing content → skip the transfer, return the existing reference

Default: **yes** when the same content is plausibly uploaded by multiple users (avatars, shared media). **No** when every upload is user-private and hash collisions between users are irrelevant.

**3. Are chunks independently retryable?**

- Each chunk has its own identity (index + content hash)
- Server acknowledges each chunk
- Client only discards local reference after ack

Default: **yes** for resumable uploads. Otherwise a retry rewinds the whole upload.

---

## Anti-Patterns

- **Single-request upload for arbitrarily large files** — first lost connection loses all progress. Users retry, fail again, abandon.
- **Chunked without session persistence** — if the app is killed mid-upload, the session is lost. User has to restart.
- **Client-side integrity without server verification** — malicious or buggy clients send corrupted data; server accepts it.
- **Direct-to-storage without finalize step** — storage accepts the write but app server never learns about it. Orphaned files, missing references.
- **Progress indication as afterthought** — any upload over a few seconds needs visible progress; without it, users cancel or double-submit.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Resumability | `Upload session survives app restart and network loss; user can resume without re-selecting file (verified by interruption + resume integration test)` |
| Integrity | `Server verifies uploaded content matches client-computed hash before committing (verified by corrupted-chunk injection test)` |
| Progress visibility | `User sees upload progress for any transfer exceeding a short threshold (verified by UI test on large file upload)` |
| Graceful failure | `Failed upload surfaces a retry affordance with enough information to diagnose; no silent drops (verified by failure injection test)` |

### Architectural Decisions

```
Upload strategy: resumable chunked upload via direct-to-storage with signed URLs. Rationale: mobile clients over unreliable networks require interruption recovery; direct-to-storage offloads bandwidth from app servers; finalize step on app server performs integrity check and metadata registration.

Integrity: server-side content hash verification on finalize. Rationale: client-side hashing alone trusts a potentially compromised client; server verification is the correctness boundary.
```

### Open Questions

```
Deduplication scope: per-user or global? Trade-off: global dedup reduces storage cost but reveals content fingerprints across users; per-user is safer but duplicates shared media.
```