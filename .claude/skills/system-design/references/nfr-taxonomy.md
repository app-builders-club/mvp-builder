# Non-Functional Requirements Taxonomy

Foundation reference for `system-design` skill. Defines the dimensions of non-functional requirements, provides a question bank with opinionated defaults, and maps answers to downstream architectural implications.

This reference is always loaded. Category-specific references (pagination, offline-sync, realtime, etc.) extend this taxonomy with domain-specific decision trees.

---

## NFR Dimensions

Eight dimensions cover the NFR space for most feature-level and product-level decisions. Every dimension answers a question the caller must resolve before implementation.

### 1. Scale Tier

**Question it answers:** how many concurrent users / requests does this need to handle?

**Why it matters:** scale dictates architectural posture — connection strategy, caching necessity, database choice, horizontal scalability concerns. At low scale, most advice is noise. At high scale, simple choices become liabilities.

**Values:**
- **Micro** — under 100 concurrent users. Single server, no caching beyond basic, optimistic architectural choices.
- **Small** — 100 to 10,000 concurrent. Load balancing helpful, caching matters, sync patterns need thought.
- **Medium** — 10,000 to 1,000,000 concurrent. CDN required, database strategy matters, horizontal scaling planned from start.
- **Large** — over 1,000,000 concurrent. Specialist design territory, most general advice no longer applies, custom infrastructure expected.

**Typical MVP default:** Small. Rapid growth scenario — assume you'll cross Small → Medium within a year.

### 2. Latency Posture

**Question it answers:** how fast must the system feel to users?

**Why it matters:** latency target drives protocol choice (REST vs gRPC), caching strategy (aggressive vs pull-through), database design (denormalization for reads), and CDN requirements.

**Values:**
- **Relaxed** — multi-second responses acceptable. Background jobs, reports, imports.
- **Standard** — sub-second for UI interactions, 1-3s for complex operations. Most product UIs.
- **Aggressive** — under 200ms for interactions, under 500ms for data loads at p95. Consumer feeds, real-time collaboration.
- **Real-time** — under 100ms. Gaming, live collaboration, trading interfaces.

**Typical MVP default:** Standard. Upgrade to Aggressive only when feature is explicitly user-facing performance-critical (feed, chat, search).

### 3. Offline Posture

**Question it answers:** must the system work without network?

**Why it matters:** offline posture determines architectural foundation. Retrofitting offline to an online-first architecture is a rewrite, not an addition.

**Values:**
- **None** — requires network, degrade gracefully on failure (error states, retry buttons).
- **Read-only offline** — cached content viewable without network. No writes, no sync complexity.
- **Full offline** — reads and writes work without network, queue and sync on reconnection.
- **Offline-first** — local is source of truth, network is optimization. All operations go through local store first.

**Typical MVP default:** None for web, Read-only offline for mobile, Full offline for mobile apps explicitly targeting unreliable connectivity.

### 4. Consistency Posture

**Question it answers:** how quickly must changes propagate to other users / devices?

**Why it matters:** consistency requirements shape data model, sync strategy, conflict resolution complexity, and real-time infrastructure choices.

**Values:**
- **Eventual** — changes may take seconds to minutes to propagate. Most content feeds, social media likes.
- **Read-your-writes** — user sees their own changes immediately, others eventually. Most user-generated content.
- **Session** — changes visible within a session, may not cross devices immediately. Most productivity apps.
- **Strong** — changes visible everywhere within seconds, with conflict resolution. Collaborative editing, multi-device productivity.
- **Transactional** — changes either apply atomically or fail. Payments, inventory, bookings.

**Typical MVP default:** Read-your-writes. Upgrade only when feature explicitly involves multi-user collaboration or financial transactions.

### 5. Real-time Posture

**Question it answers:** how do users learn about changes from other sources?

**Why it matters:** real-time posture determines transport choice (polling vs SSE vs WebSocket vs push) and infrastructure cost.

**Values:**
- **None** — changes seen on next manual refresh. Static content, settings pages.
- **Event-driven** — changes delivered on-demand (push notifications, refresh triggers). Most messaging apps when backgrounded.
- **Live** — changes appear within seconds without user action. Active chat, live feed, presence.
- **Continuous** — sub-second updates streaming. Collaborative cursors, live video, trading.

**Typical MVP default:** None unless feature description explicitly describes live updates. Most features are not real-time.

### 6. Data Volume

**Question it answers:** how large are payloads, how much storage on client, how much over the network?

**Why it matters:** data volume shapes pagination requirements, caching strategy, upload/download architecture, and network optimization needs.

**Values:**
- **Small** — JSON payloads under 10KB, total client storage under 10MB. Most CRUD apps.
- **Medium** — lists with pagination, occasional larger payloads, client storage 10-100MB. Feed-style apps.
- **Large** — user-uploaded media, local caches in hundreds of MB, per-request payloads over 1MB. Photo sharing, document apps.
- **Extreme** — streaming video, multi-GB local stores, synced large files. Video platforms, Dropbox-style apps.

**Typical MVP default:** Small. Upgrade to Medium when feed/list is a primary feature, Large when media is a primary feature.

### 7. Security Posture

**Question it answers:** what categories of data does this handle, what regulatory requirements apply?

**Why it matters:** security posture drives encryption, audit logging, access control depth, and compliance requirements. Cannot be retrofitted cheaply.

**Values:**
- **Public** — no authentication, no user data. Marketing sites, public content.
- **Authenticated** — users sign in, basic PII (email, name). Most consumer apps.
- **Sensitive** — health, financial, location, private messages. Requires encryption at rest, audit logging, careful access control.
- **Regulated** — HIPAA, PCI-DSS, SOX, GDPR Article 9 special categories. Requires compliance program, not just technical controls.

**Typical MVP default:** Authenticated. Never assume Public unless feature description explicitly has no user data. Upgrade to Sensitive when feature handles any of the listed categories.

### 8. Target Environment

**Question it answers:** what network, device, and user conditions is this designed for?

**Why it matters:** environment assumptions drive data payload sizing, image formats, connectivity strategy, device capability expectations.

**Values:**
- **Developed / enterprise** — broadband, modern devices, reliable network. Desktop-first web apps, enterprise tools.
- **Developed consumer** — mix of WiFi and 4G/5G, mid to high-end devices, mostly reliable network. Most consumer mobile apps.
- **Emerging markets** — intermittent 3G/4G, low-end Android devices, expensive data, frequent connectivity loss. Lite-app patterns required.
- **Extreme** — satellite, industrial, remote field work, megabits per day. Specialist design.

**Typical MVP default:** Developed consumer. Confirm with user if product targets specific regions — defaulting Emerging markets to Developed silently produces unusable apps.

---

## Dimension → Category Matrix

Which dimensions matter for which triage categories from `SKILL.md`. Used to narrow dialogue — don't ask dimensions irrelevant to the feature.

| Dimension | Simple CRUD | Data-heavy | Real-time | Offline-critical | Media-heavy | Integration-heavy | Low-bandwidth | Cross-platform | Frequent UI iteration |
|-----------|:-----------:|:----------:|:---------:|:----------------:|:-----------:|:-----------------:|:-------------:|:--------------:|:---------------------:|
| Scale | Ask | Ask | Ask | Ask | Ask | Ask | Ask | Ask | Ask |
| Latency | Default | Ask | Ask | Default | Ask | Ask | Ask | Default | Default |
| Offline | Default | Ask | Ask | Ask | Ask | Default | Ask | Default | Default |
| Consistency | Default | Ask | Ask | Ask | Default | Ask | Default | Default | Default |
| Real-time | Default | Ask | Ask | Default | Default | Ask | Default | Default | Default |
| Data volume | Default | Ask | Default | Ask | Ask | Default | Ask | Default | Default |
| Security | Ask | Ask | Ask | Ask | Ask | Ask | Ask | Ask | Ask |
| Environment | Ask | Default | Default | Ask | Ask | Default | Ask | Ask | Default |

**Ask** — include in dialogue, genuine decision point.
**Default** — assume default without asking unless context signals otherwise.

Scale and Security always ask — they affect too much downstream to assume. Environment asks when feature is mobile or targets specific regions.

---

## Question Bank

Reusable questions per dimension. Skill picks from this bank based on category matrix.

### Scale Tier

```
Expected concurrent users for this feature?
  a) Under 100 concurrent (default — most MVPs and B2B tools)
  b) 100 to 10,000 concurrent (growth phase, public consumer app pre-viral)
  c) 10,000 to 1,000,000 concurrent (scale phase, established consumer app)
  d) Over 1,000,000 concurrent (specialist infrastructure required)
```

### Latency Posture

```
How fast must this feel to users?
  a) Multi-second responses acceptable (default for background tasks, reports)
  b) Sub-second for UI, 1-3s for complex ops (default for most product UIs)
  c) Under 200ms interactions, under 500ms data loads at p95 (consumer feeds)
  d) Under 100ms (live collaboration, gaming, trading)
```

### Offline Posture

```
Must this work without network?
  a) Network required, show error states on failure (default for web)
  b) Read-only offline — cached content viewable, writes require network (default for mobile)
  c) Full offline — reads and writes queue and sync on reconnection
  d) Offline-first — local is source of truth, network is optimization
```

### Consistency Posture

```
How quickly must changes propagate across users or devices?
  a) Eventual — seconds to minutes acceptable (default for social content)
  b) Read-your-writes — user sees own changes immediately, others eventually (default)
  c) Session — visible within same session, may lag across devices
  d) Strong — visible everywhere within seconds, with conflict resolution
  e) Transactional — atomic or fails (payments, inventory, bookings)
```

### Real-time Posture

```
How do users learn about changes from other sources?
  a) Manual refresh only (default for most features)
  b) Push notifications or refresh triggers (messaging when backgrounded)
  c) Live updates within seconds without user action (active chat, presence)
  d) Continuous sub-second streaming (collaborative cursors, trading)
```

### Data Volume

```
What data volume does this feature handle?
  a) Small JSON, client storage under 10MB (default — most CRUD)
  b) Lists with pagination, client storage 10-100MB (feed-style)
  c) User media, client caches hundreds of MB (photo sharing)
  d) Streaming, multi-GB local stores (video, Dropbox-style)
```

### Security Posture

```
What data categories does this handle?
  a) No user data — public content (marketing, docs)
  b) Basic PII — email, name, standard profile (default for authenticated apps)
  c) Sensitive — health, financial, location, private messages
  d) Regulated — HIPAA, PCI-DSS, GDPR special categories
```

### Target Environment

```
What network and device environment is this designed for?
  a) Broadband and modern devices (default for B2B, desktop web)
  b) Mix of WiFi and 4G/5G, mid-range devices (default for consumer mobile)
  c) Emerging markets — intermittent 3G/4G, low-end Android, expensive data
  d) Extreme — satellite, industrial, remote field
```

---

## Decision Implications

Each answer has concrete downstream implications. Skill uses this to narrow subsequent questions and to propose architectural decisions.

### Scale Tier Implications

| Answer | Implications |
|--------|--------------|
| Micro | Skip CDN questions. Skip horizontal scaling concerns. Single-server architecture acceptable. |
| Small | CDN for static assets. Database read replicas optional. Basic caching required. |
| Medium | CDN required. Database sharding planning. Aggressive caching. Connection pooling. |
| Large | Not MVP territory. Redirect user to specialist design consideration. |

### Latency Posture Implications

| Answer | Implications |
|--------|--------------|
| Relaxed | No caching discussion needed. REST is fine. |
| Standard | Basic HTTP caching. Pagination for lists. |
| Aggressive | CDN, edge caching, denormalized reads, possibly gRPC for internal. Prefetching important. |
| Real-time | WebSocket or persistent connection required. Standard REST insufficient. |

### Offline Posture Implications

| Answer | Implications |
|--------|--------------|
| None | Loads `caching.md` at most. No sync discussion. |
| Read-only offline | Loads `caching.md`. Simple local cache strategy sufficient. |
| Full offline | Loads `offline-sync.md`, `data-model.md`. Sync engine required. Two-ID problem relevant. Conflict resolution strategy required. |
| Offline-first | Same as full offline plus architectural posture affects every feature decision. |

### Consistency Posture Implications

| Answer | Implications |
|--------|--------------|
| Eventual | LWW (last-write-wins) acceptable for conflicts. |
| Read-your-writes | Optimistic UI with rollback on server rejection. |
| Session | Session affinity or pull-through cache. |
| Strong | Server-authoritative conflict resolution required. Consider CRDT for specific features. |
| Transactional | Two-phase commit or transactional APIs required. Idempotency keys mandatory. |

### Real-time Posture Implications

| Answer | Implications |
|--------|--------------|
| None | No real-time transport needed. Skip `realtime.md`. |
| Event-driven | Push notifications (APNs/FCM). Optional in-app refresh. Skip WebSocket complexity. |
| Live | Loads `realtime.md`. SSE or WebSocket decision. Polling fallback. |
| Continuous | WebSocket required. Optimization for bandwidth and battery becomes critical. |

### Data Volume Implications

| Answer | Implications |
|--------|--------------|
| Small | Skip pagination discussion. Skip chunked upload. |
| Medium | Loads `pagination.md`. Field selection may matter. |
| Large | Loads `media-upload.md`, `caching.md`. Chunked uploads required. CDN for downloads. |
| Extreme | Specialist territory. Streaming protocols (HLS, DASH). Custom infrastructure. |

### Security Posture Implications

| Answer | Implications |
|--------|--------------|
| Public | Minimal auth requirements. Still consider bot protection. |
| Authenticated | Standard auth (per `authentication.md` rule). Session management. |
| Sensitive | Encryption at rest. Audit logging. Access control per resource. App Attestation on mobile. |
| Regulated | Compliance program required beyond technical controls. Redirect to specialist. |

### Environment Implications

| Answer | Implications |
|--------|--------------|
| Developed / enterprise | Modern browser APIs assumed. Broadband assumed. |
| Developed consumer | Responsive design, retry logic, basic offline for mobile. |
| Emerging markets | Loads `network-optimization.md`. Lite-app patterns. Aggressive payload sizing. Image format optimization. |
| Extreme | Specialist territory. Custom protocols. |

---

## Red Flags

Answer combinations that require explicit attention. Skill surfaces these as warnings or additional questions.

### Scale: Large

Over 1 million concurrent users is not MVP territory. Surface as warning:

> "Large scale (>1M concurrent) requires specialist infrastructure design beyond general patterns. This skill provides guidance for features at Small to Medium scale. Recommend deferring architectural finalization until scale is validated, or engaging infrastructure specialist."

### Offline: Full or Offline-first + Consistency: Strong

Full offline with strong cross-user consistency is extremely complex. Either becomes a CRDT project or requires relaxing one. Surface:

> "Full offline with strong consistency requires either conflict-free replicated data types (CRDTs) or session-based access patterns. This is a significant architectural commitment. Is strong consistency required, or can eventual consistency work for offline scenarios?"

### Security: Regulated

HIPAA, PCI-DSS, GDPR Article 9 require compliance programs beyond code. Surface:

> "Regulated data (health, payment, special categories) requires compliance infrastructure beyond technical architecture — audit programs, breach notification, legal review. Technical patterns here cover necessary conditions but not sufficient ones. Confirm compliance program is in place."

### Environment: Emerging markets + Data Volume: Large or Extreme

Heavy media in emerging markets requires aggressive optimization. Surface:

> "Large media payloads in emerging markets require specific optimization — WebP/AVIF formats, aggressive thumbnailing, opt-in HD downloads, data-saver modes. Confirm these are in scope; generic media features don't work under these conditions."

### Real-time: Continuous + Scale: Small or Medium

Continuous real-time at scale requires specialist infrastructure. Surface:

> "Continuous real-time (sub-second streaming) at Medium+ scale requires specialized infrastructure — edge proximity, WebSocket fanout, dedicated streaming services. Confirm continuous real-time is actually required, or whether Live (updates within seconds) suffices."

---

## Worked Examples

How dimensions apply to three representative feature types.

### Example 1: User Profile Page

**Triage category:** Simple CRUD.

**Relevant dimensions:** Scale, Security. Most others default.

**Dialogue (2 questions):**
- Scale? → Small (default)
- Security? → Authenticated (default)

**Resulting analysis:**
- Required behaviors: basic (page loads within standard latency, shows retry on failure)
- Architectural decisions: none beyond platform defaults
- Open questions: none

**Why minimal:** profile page is CRUD. No offline sync, no real-time, no pagination, no media. Dimensions that defaulted are dimensions that don't need explicit decisions for this feature.

### Example 2: Social Feed

**Triage category:** Data-heavy + Real-time + Media-heavy.

**Relevant dimensions:** Scale, Latency, Offline, Consistency, Real-time, Data volume, Security, Environment.

**Dialogue (6 questions, skipping environment since caller is developed consumer):**
- Scale? → Small growing to Medium
- Latency? → Aggressive (consumer feed)
- Offline? → Read-only offline
- Consistency? → Eventual (likes, comments)
- Real-time? → Live (new items visible without refresh)
- Data volume? → Medium to Large (images)

**Resulting analysis:**
- Required behaviors: latency targets, offline read, sync indicators, retry states
- Architectural decisions: cursor pagination, SSE for live updates, L1/L2 caching, image format optimization, prefetching threshold
- Open questions: cross-device sync for likes? Cache expiry strategy?

**Why many decisions:** feed touches seven dimensions, each with architectural implications.

### Example 3: Payment Checkout

**Triage category:** Integration-heavy + Simple CRUD at core.

**Relevant dimensions:** Scale, Latency, Consistency (transactional), Security (sensitive or regulated), Real-time (none).

**Dialogue (4 questions):**
- Scale? → Small
- Latency? → Standard (payment flows tolerate 1-2s)
- Consistency? → Transactional
- Security? → Sensitive (payment data) → elevates to Regulated if storing card details

**Resulting analysis:**
- Required behaviors: idempotency guarantees, audit logging, transaction atomicity
- Architectural decisions: idempotency keys on all mutations, third-party payment processor (never store cards), server-side transaction verification, webhook signature validation
- Open questions: refund flow scope? Subscription vs one-time?

**Why specific:** Transactional consistency + Sensitive security forces specific patterns regardless of scale.

---

## Output Phrasing Reference

How NFR dimension answers translate into Required Behaviors in the skill output. Caller picks the appropriate template.

| Dimension | Answer | Behavior Template |
|-----------|--------|-------------------|
| Scale | Small or larger | `System handles [N] concurrent users without degradation (verified by load test at target concurrency)` |
| Latency | Standard | `System responds within 1s at p95 for data operations (verified by performance test)` |
| Latency | Aggressive | `System responds within 500ms at p95 under normal network (verified by performance test with 100 concurrent requests)` |
| Offline | Read-only | `User views previously loaded [content type] without network connection (verified by airplane mode test)` |
| Offline | Full | `System persists user actions when offline and syncs on reconnection (verified by offline queue test)` |
| Consistency | Read-your-writes | `User sees own changes immediately after submission (verified by UI integration test)` |
| Consistency | Strong | `Changes by one user visible to others within [N] seconds (verified by multi-client integration test)` |
| Consistency | Transactional | `Operation completes atomically or fails completely, never partial (verified by failure injection test)` |
| Real-time | Live | `New [content type] appears in UI within [N] seconds of server receipt without user action (verified by multi-client test)` |
| Data volume | Medium | `System paginates [list type] to avoid loading entire dataset (verified by bounded memory test)` |
| Data volume | Large | `System supports [media type] uploads over [N]MB with resumable transfer (verified by interruption test)` |
| Security | Sensitive | `All [sensitive data type] encrypted at rest (verified by storage audit)` |
| Security | Sensitive | `Access to [resource] logged with user identity and timestamp (verified by audit log review)` |
| Environment | Emerging markets | `Feature functions on 3G connections under 100kbps (verified by throttled network test)` |

Callers supply the concrete values ([N], [content type], [media type]) based on feature specifics. The skill's output uses this form, caller fills blanks during integration into their artifact.

---

## Invariants

- Every question has an opinionated default — no "it depends" as default
- Defaults favor MVP pragmatism over theoretical correctness
- Red flags are surfaced as explicit warnings, not hidden in defaults
- Dimension matrix prevents irrelevant questions for a given category
- Every answer maps to concrete downstream implications — no dead-end dimensions