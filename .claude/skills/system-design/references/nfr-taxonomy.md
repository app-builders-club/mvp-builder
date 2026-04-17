# NFR Taxonomy

Foundation reference. Always loaded. Defines the dimensions of non-functional requirements, provides a question bank with opinionated defaults, and maps answers to downstream implications.

Category-specific references extend this taxonomy for their domain.

---

## NFR Dimensions

Eight dimensions cover feature-level and product-level decisions. Every dimension answers a question the caller must resolve before implementation.

### 1. Scale Tier

How many concurrent users / requests must the feature handle?

| Tier | Range | Implication | Default |
|------|-------|-------------|---------|
| Micro | <100 | Single server, no caching needed | — |
| Small | 100–10K | Load balancing helpful, caching matters | ✅ MVP |
| Medium | 10K–1M | CDN required, horizontal scaling planned from start | — |
| Large | >1M | Specialist territory, general advice no longer applies | Red flag |

### 2. Latency Posture

How fast must the system feel?

| Posture | Target | Typical use |
|---------|--------|-------------|
| Relaxed | Multi-second responses OK | Background jobs, reports, imports |
| Standard | Sub-second UI, 1–3s complex | Most product UIs (default) |
| Aggressive | <200ms interactions, <500ms data p95 | Consumer feeds, real-time collaboration |
| Real-time | <100ms | Gaming, live collaboration, trading |

Default: **Standard**. Upgrade to Aggressive only when the feature is explicitly performance-critical (feed, chat, search).

### 3. Offline Posture

Must the system work without network?

| Posture | Behavior |
|---------|----------|
| None | Requires network; degrade gracefully on failure (error + retry) |
| Read-only offline | Cached content viewable without network; no writes |
| Full offline | Reads and writes work offline; queue and sync on reconnection |
| Offline-first | Local is source of truth; network is optimization |

Default: **None** for web, **Read-only** for mobile, **Full** for mobile with explicit unreliable-connectivity target. Retrofitting offline to an online-first architecture is a rewrite — commit early.

### 4. Consistency Posture

How quickly must changes propagate?

| Posture | Propagation | Use |
|---------|-------------|-----|
| Eventual | Seconds to minutes | Content feeds, social likes |
| Read-your-writes | Own changes immediately, others eventual | Most user-generated content (default) |
| Session | Within a session, not cross-device | Most productivity apps |
| Strong | Everywhere within seconds, with conflict resolution | Collaborative editing, multi-device productivity |
| Transactional | Atomic apply-or-fail | Payments, inventory, bookings |

Default: **Read-your-writes**. Upgrade only for explicit multi-user collaboration or financial transactions.

### 5. Real-time Posture

How do users learn about changes from other sources?

| Posture | Behavior | Use |
|---------|----------|-----|
| None | Manual refresh | Static content, settings (default) |
| Event-driven | On-demand delivery (push notifications, triggered refresh) | Messaging backgrounded |
| Live | Changes appear within seconds without user action | Active chat, live feed, presence |
| Continuous | Sub-second streaming | Collaborative cursors, live video, trading |

Default: **None** unless the feature explicitly describes live updates.

### 6. Data Volume

How large are payloads / local storage / network transfer?

| Volume | Scale | Use |
|--------|-------|-----|
| Small | Payloads <10KB, storage <10MB | Most CRUD (default) |
| Medium | Paginated lists, storage 10–100MB | Feed-style apps |
| Large | User media, storage hundreds of MB, payloads >1MB | Photo sharing, documents |
| Extreme | Streaming video, multi-GB local, synced large files | Video platforms, cloud file sync |

Default: **Small**. Upgrade to Medium when feed/list is primary; Large when media is primary.

### 7. Security Posture

What data categories + regulatory requirements?

| Posture | Data | Implication |
|---------|------|-------------|
| Public | No auth, no user data | Marketing sites, public content |
| Authenticated | Users sign in, basic PII | Most consumer apps (default) |
| Sensitive | Health, financial, location, private messages | Encryption at rest, audit logging, careful access control |
| Regulated | HIPAA, PCI-DSS, SOX, GDPR Art. 9 | Compliance program required, not just technical controls |

Default: **Authenticated**. Never assume Public without explicit confirmation. Cannot be retrofitted cheaply.

### 8. Target Environment

What network, device, user conditions?

| Environment | Conditions | Implication |
|-------------|------------|-------------|
| Developed / enterprise | Broadband, modern devices, reliable network | Desktop-first web, enterprise tools |
| Developed consumer | WiFi + 4G/5G, mid-to-high devices, mostly reliable | Most consumer mobile (default) |
| Emerging markets | Intermittent 3G/4G, low-end Android, expensive data | Lite-app patterns required |
| Extreme | Satellite, industrial, remote field work | Specialist territory |

Default: **Developed consumer**. Confirm if product targets specific regions — defaulting Emerging silently produces unusable apps.

---

## Dimension → Category Matrix

Which dimensions to ask about for which triage category. `Ask` = prompt user. `Default` = apply default silently.

| Dimension | CRUD | Data | RT | Offline | Media | Integration | Cross-plat | UI iter |
|-----------|:----:|:----:|:--:|:-------:|:-----:|:-----------:|:----------:|:-------:|
| Scale | Ask | Ask | Ask | Ask | Ask | Ask | Ask | Ask |
| Latency | Default | Ask | Ask | Default | Ask | Ask | Default | Default |
| Offline | Default | Ask | Ask | Ask | Ask | Default | Default | Default |
| Consistency | Default | Ask | Ask | Ask | Default | Ask | Default | Default |
| Real-time | Default | Default | Ask | Default | Default | Default | Default | Default |
| Data volume | Default | Ask | Default | Ask | Ask | Default | Default | Default |
| Security | Ask | Ask | Ask | Ask | Ask | Ask | Default | Ask |
| Environment | Default | Default | Default | Ask | Default | Default | Ask | Default |

---

## Red Flags

Answer combinations requiring explicit warning in the output.

| Combination | Warning to surface |
|-------------|---------------------|
| Scale: Large | >1M concurrent is not MVP territory. Recommend deferring architectural finalization until scale is validated, or engage infrastructure specialist. |
| Offline: Full/first + Consistency: Strong | Requires CRDTs or session-based access. Significant architectural commitment. Confirm strong consistency is needed, or if eventual works for offline. |
| Security: Regulated | Requires compliance infrastructure beyond technical architecture — audit, breach notification, legal review. Technical patterns cover necessary but not sufficient conditions. |
| Environment: Emerging + Data volume: Large/Extreme | Heavy media in emerging markets requires aggressive optimization (modern formats, aggressive thumbnailing, opt-in HD, data-saver modes). Confirm in scope. |
| Real-time: Continuous + Scale: Medium+ | Sub-second streaming at scale requires edge proximity, WebSocket fanout, dedicated streaming services. Confirm Continuous is needed, or whether Live suffices. |

---

## Output Phrasing Reference

How NFR answers translate into Required Behaviors. Caller fills concrete values.

| Dimension | Answer | Behavior Template |
|-----------|--------|-------------------|
| Scale | Small+ | `System handles [N] concurrent users without degradation (verified by load test at target concurrency)` |
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
| Environment | Emerging | `Feature functions on 3G connections under 100kbps (verified by throttled network test)` |