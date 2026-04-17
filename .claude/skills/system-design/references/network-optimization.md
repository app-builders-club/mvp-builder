# Network Optimization

Reference for designing apps that perform well on constrained networks — emerging markets, cellular with variable signal, metered connections, older devices. Loaded when triage identifies Low-bandwidth target environments, Media-heavy features, or features explicitly targeting unreliable connectivity.

Grounded in Meta's Facebook Lite architecture (proxy server, thin client, 430KB APK, custom protocol), Snap's production QUIC rollout (measured 6-20% p90 latency improvement, connection migration benefits), and Meta's Facebook QUIC deployment (22% improvement in video mean time between rebuffering on poor networks).

---

## The Emerging Markets Reality

Design assumptions that break in emerging markets — and increasingly, in any mobile context:

- **2G coverage is the baseline in much of the world.** 96% of global population has 2G coverage; 1.6 billion people live where 3G/4G is not available or reliable (Meta's FB Lite launch data, 2015, remains directionally accurate).
- **Data is expensive.** Meta documented $1.20/GB in Pakistan, $2.80/GB in Kenya. A 20MB app download can be a meaningful fraction of a monthly data budget.
- **Connections are intermittent.** 3G signal drops to 2G drops to no signal dozens of times daily. Apps that assume "online" as a binary fail here.
- **Devices are constrained.** 1GB RAM phones still dominant in many markets. 50MB free storage isn't unusual. CPU is slow.
- **Network latency is high.** 300ms+ RTTs common on 2G; 3G jumps variably between 100-500ms.

Apps designed only for developed markets frequently don't work at all in emerging markets — not "work slower," but "fail to function."

Even in developed markets, these constraints apply intermittently: subway, basement, rural driving, international roaming.

---

## Transport Layer: QUIC / HTTP/3

Before optimizing payloads, optimize the transport. QUIC (HTTP/3) outperforms TCP+TLS+HTTP/2 substantially on constrained networks.

### What QUIC Brings

Compared to TCP+TLS+HTTP/2:

**Faster connection establishment.** QUIC handshake is 1-RTT (or 0-RTT for resumption). TCP+TLS requires 3 RTTs (TCP handshake + TLS handshake). On 2G with 500ms RTT, that's 1 second saved on every new connection.

**Multiplexing without head-of-line blocking.** HTTP/2 over TCP suffers when a single packet is lost — all streams on the connection stall waiting for retransmission. QUIC's streams are independent; loss on one stream doesn't block others.

**Connection migration across IP addresses.** TCP connections die when IP changes (WiFi to cellular, roaming). QUIC connections are identified by a 64-bit connection ID, not IP+port, so they survive network transitions without reconnection.

**Better loss detection.** QUIC detects lost connections faster than TCP's typically long timeout. Users don't stare at loading spinners as long.

### Snap's Measured Results

Snap rolled out QUIC across their services and published metrics:

- **p90/p99 network latency improved 6-20%.** Larger improvements on low-connectivity user cohorts.
- **Network errors reduced 3-8%.**
- **Ads service rollout (October 2019)** showed these gains in production, not lab tests.
- **Connection setup p90 went from ~300ms pre-QUIC** to meaningfully less with 1-RTT handshakes.

### Meta's FB Video Results

Meta rolled out QUIC for Facebook video and documented:

- **Mean time between rebuffering (MTBR) improved by up to 22%.**
- **Video errors reduced 8%.**
- **Video stalls reduced 20%.**
- **Outsized impact on networks with poorer conditions, especially emerging markets.**

### Adoption Approach

**Use Cronet (Chromium's network stack)** for cross-platform QUIC support. Snap uses Cronet on both iOS and Android — same network behavior, same metrics, single code path. Avoid platform-specific QUIC implementations unless Cronet specifically can't fit.

**Protocol selection per country/platform.** Snap doesn't enforce QUIC everywhere — they choose protocols based on observed network performance per country. Not all middleboxes handle UDP-based QUIC; some networks block UDP on ports other than 53/123. Have TCP+TLS fallback.

**Start with specific services.** Snap rolled out QUIC per service (ads, media fetch, messaging). Don't migrate everything at once — measure per-service impact.

### When to apply

- **Production apps serving users on cellular or emerging markets** — QUIC pays for itself
- **Video or large media delivery** — congestion control improvements and multiplexing matter most here
- **Messaging or real-time apps** — connection migration preserves UX across network transitions
- **MVP without emerging market users** — QUIC is free if you're behind a CDN that supports HTTP/3 (CloudFront, Cloudflare, Fastly). Otherwise, defer until infrastructure team has capacity.

---

## The Lite App Architecture

Meta's Facebook Lite is the canonical reference for building apps designed for constrained networks and devices. The architecture decisions are worth documenting as a coherent pattern.

### APK Size as Feature

**Original FB Lite APK: ~430KB at launch** (later grew to ~1MB as features added). The standard Facebook app is 9.7MB in "slim" Lite form, 128MB in full form.

Why size matters specifically:
- Downloading 20MB over 2G takes 30+ minutes, often fails mid-download
- Users on 50MB free storage can't install large apps
- App updates consume data budget; monthly updates × MB adds up

**Techniques to hit small APK:**

1. **Vector drawables instead of PNG** (FB Lite reduced icon bundle from 14.2MB to 1.8MB)
2. **Unicode symbols instead of image icons** where visually acceptable
3. **Native library pruning** — FB Lite supports only ARMv7 and ARM64 (no x86, no MIPS). Cuts native binary size ~68%. ABI distribution data shows 99%+ of target devices are ARM.
4. **Server-side localization** — strings and translations fetched on demand, not bundled
5. **Deferred resource loading** — PNG/SVG assets loaded from server and cached

### Thin Client, Heavy Server

FB Lite architecturally is a **thin rendering VM** on the client, with **product logic on server**. Client provides:
- OS integration (camera, file system, SQLite, notifications)
- Rendering engine (takes server-sent UI tree, renders native Android views)
- Local cache

Product code lives on server. Server fetches from backend, packages into compressed UI tree, sends to client. Client renders — no product logic embedded.

This is related to (but distinct from) Server-Driven UI (see `server-driven-ui.md`). SDUI sends UI sections as structured data; Lite architecture goes further — entire product logic lives server-side.

**Trade-off:** every interaction requires server round-trip. Latency-sensitive features suffer. Works because Meta's Lite serves predominantly view-oriented workflows (feed browsing, messaging) where interactions are inherently round-trips.

**When to apply:**
- Target audience explicitly includes emerging markets or low-end devices
- Product team is comfortable with server-heavy architecture
- App features are read-dominant (feed, catalog, messages)
- NOT for offline-critical apps — thin client can't work offline

### Custom Protocol Over Standard HTTPS

FB Lite uses **custom message protocol over TLS (not HTTPS).** Reasons:

- Fewer round trips for connection establishment
- Smaller header overhead per message (HTTP headers are verbose)
- Persistent TLS connection for entire session (push + pull over same connection)
- Single server per session allows server-initiated messages without separate infrastructure

**When to apply:** almost never for MVPs. This is infrastructure-heavy and only justifies itself at Meta's scale. For MVP-level apps, HTTPS/QUIC is fine.

**What to take from this:** the principle that standard HTTP wasn't the right fit. For your product, maybe HTTPS is fine; maybe a persistent WebSocket or QUIC stream is better. Don't assume REST-over-HTTPS for everything.

### Image Optimization

FB Lite dedicates image servers that talk to CDN and serve **exact-size images** to client. Client does not download full-resolution and downsample — server sends the size the client needs.

**Combined with:**

- **WebP over JPEG** as default format (WebP is ~25-30% smaller at same visual quality)
- **Adaptive quality by network:** 65% quality on 2G, 75% on 3G, 85% on 4G/LTE (FB Lite's tiered approach)
- **Device-aware sizing:** server knows client's screen density, sends appropriate resolution

**Server-side image pipeline responsibilities:**
- Resize to device-requested dimensions
- Encode in optimal format (WebP with JPEG fallback for older clients)
- Apply quality scaling based on network hint from client
- Cache variants at CDN edge

**Client responsibilities:**
- Send network state hint with image request (connection type, bandwidth estimate)
- Decode progressively — show low-quality version first, upgrade when full arrives
- Cache decoded bitmaps (see `caching.md`)

### When to apply the Lite pattern

- **Explicit emerging-market strategy** (Brazil, India, Indonesia, Mexico, Philippines are Meta's primary Lite markets)
- **User research shows significant low-end-device user base**
- **Data cost is a documented user concern** from support tickets or reviews
- **NOT for apps already committed to offline-first architecture** — these patterns conflict

---

## Payload Reduction Strategies

Below transport layer, minimize bytes transferred.

### Compression

- **Brotli** is the modern default — 20-30% better than gzip for text payloads. All major CDNs and browsers support it.
- **gzip** remains the minimum. Any API response >1KB should be compressed.
- **Compression ratio** varies by content — JSON compresses well (70-80% reduction), pre-compressed formats (images, video) don't compress further.
- **Per-response `Content-Encoding`** header: `br` for Brotli, `gzip` for gzip, client sends `Accept-Encoding` in request.

### Image Format Selection

| Format | When | Savings |
|--------|------|---------|
| **AVIF** | Modern clients, photo content | 50% smaller than JPEG at equivalent quality |
| **WebP** | Widely-supported modern, photos and graphics | 25-30% smaller than JPEG |
| **JPEG** | Universal fallback for photos | Baseline |
| **PNG** | Transparent graphics, UI icons (avoid for photos) | Large — prefer WebP/AVIF |
| **SVG / Vector drawables** | Icons, logos, simple graphics | Scalable, tiny (<5KB typical) |

**Implementation pattern:** server accepts `Accept` header, returns the best format the client supports. Same URL, different format per client. CDN caches variants.

### Payload Schema Choices

- **JSON is the default** — debuggable, universal, tooling is mature
- **Protobuf** is 30-50% smaller than JSON, but adds schema generation complexity. Use for internal services or when Lyft-scale volume justifies.
- **MessagePack / CBOR** — binary JSON-like format, smaller than JSON, simpler than protobuf. Middle ground.
- **For MVPs, JSON + Brotli is the right answer.** Don't chase protobuf until measurements justify.

### Field Selection

Large API responses often include fields the client doesn't need. Reduce:

- **GraphQL** — client specifies exactly which fields to fetch (see `api-selection.md`)
- **REST with `fields` parameter** — `GET /users/123?fields=id,name,avatar` returns only requested fields
- **Sparse fieldsets (JSON:API style)** — structured way to request subsets

Payload reduction of 70%+ is achievable by skipping server-side computation and transmission of unused fields.

---

## Connection Optimization

### Connection Reuse

- **HTTP/2 and HTTP/3 multiplex multiple requests over a single connection** — setup cost amortized across all requests to the same origin
- **Keep-Alive** for HTTP/1.1 if you must support older clients
- **Connection pool sizing** on client — typically 4-6 parallel connections per origin is sufficient

### DNS Prefetching

- First request to a new origin requires DNS resolution (typically 50-200ms)
- `<link rel="dns-prefetch">` on web, proactive DNS queries on mobile
- Prefetch DNS for known API endpoints at app startup — eliminates DNS latency on first actual request

### TLS Session Resumption

- Full TLS handshake: 2 RTTs
- TLS session resumption (session tickets, session IDs): 1 RTT
- TLS 1.3 with 0-RTT: 0 RTTs for resumed connections (replay-safe only for idempotent requests)

Ensure TLS session caching is enabled. On mobile, sessions often reused across app launches.

### Connection Warm-Up

For predictable first requests (e.g., app launches → always fetches /feed first):

- Prewarm DNS
- Prewarm TLS connection (issue empty request or use HTTP/3 0-RTT)
- Prewarm CDN cache by issuing request server-side before user arrives

Trade-off: prewarm cost vs. user-perceived latency. Only prewarm for high-confidence predictions.

---

## Adaptive Quality

Match payload size to observed network conditions.

### Client-Side Network Detection

- **`navigator.connection.effectiveType`** (web) — returns "slow-2g", "2g", "3g", "4g"
- **iOS `NWPathMonitor`** — returns interface type (cellular, WiFi, wired), `isExpensive` for metered
- **Android `ConnectivityManager`** — similar signals

Detection isn't perfect — "4g" label may still be slow in practice. Combine with measured bandwidth (time + bytes of recent requests).

### Per-Tier Strategy

FB Lite's approach generalizes well:

| Connection Quality | Image Quality | Video | Prefetching |
|---------------------|---------------|-------|-------------|
| Slow 2G | 65% WebP | Off / audio-only | Off |
| 2G / Slow 3G | 75% WebP | 360p | Limited |
| 3G | 85% WebP | 720p | Moderate |
| 4G / WiFi | 95% WebP | 1080p | Aggressive |

Send network hint with requests; server tailors response. Or client downloads appropriate variant.

### Save-Data Mode

- **HTTP `Save-Data: on` header** — user has explicitly opted into data saving
- Respect it: lower-quality images, no video autoplay, minimal prefetching
- Browser/OS provides; app must not override

### Explicit User Control

In addition to automatic detection, provide **user-facing data saving toggle** in settings:

- "Data saver" mode — always lowest quality, never prefetch
- "HD only on WiFi" — sensible default
- "Always HD" — opt-in for users who prefer quality

Users in metered markets actively manage data consumption. Defaults matter; controls matter more.

---

## Retry and Backoff

Network failures are common in constrained environments. Retry strategy determines whether errors are recoverable or user-visible.

### Categorize Errors

Same categorization as `offline-sync.md`:

- **Temporary** (5xx, network timeout, DNS failure, connection reset): retry with backoff
- **Permanent** (4xx except 408/429): don't retry, surface error

### Exponential Backoff with Jitter

- Start at 1-5 seconds
- Double on each retry: 1s, 2s, 4s, 8s, 16s
- Cap at reasonable ceiling (30-60s)
- **Jitter** — add random variation to prevent thundering herd when service recovers

### Cap Total Retry Time

Retrying forever pins the radio and drains battery. Typical cap:
- 5-10 retries
- Or 5-10 minutes total elapsed time
- Whichever comes first

### Retry-After Header

`429 Too Many Requests` and `503 Service Unavailable` may return `Retry-After` header. Honor it — server is telling the client how long to wait. Don't retry more aggressively than the header specifies.

### Circuit Breaker

At higher levels of abstraction, client tracks failure rate. If requests to endpoint X have been failing for the last N seconds:
- Fail fast locally without attempting network
- Check periodically if endpoint recovered
- Resume normal operation when health restored

Prevents flood of retries when a service is down.

---

## Measurement and Instrumentation

Optimizations without measurement are theater.

### What to Instrument

- **Request latency** at p50, p95, p99 — tails matter more than means
- **Error rate** per endpoint, per error type
- **Bytes transferred** per request, aggregated per user per day
- **Connection establishment time** — DNS, TCP/QUIC handshake, TLS handshake
- **Time to first byte** (TTFB) vs. full response time
- **Retries per request** — high retries indicate network instability
- **Battery impact** — radio-on time per session

### Slice by Conditions

Global averages hide problems:
- **Per network type** (2G, 3G, 4G, WiFi)
- **Per country** (infrastructure varies)
- **Per device tier** (low-end Android vs. flagship iOS)
- **Per app version** (rollout comparison)

A 10% regression in p99 latency on "low-end Android in India" may be invisible in global average but catastrophic for that user cohort.

### Field vs. Lab Data

- **Lab testing** — throttled connections in dev environment — catches obvious issues
- **Field data** — real users, real networks — catches actual problems
- Snap's QUIC improvements were only visible in production telemetry; lab numbers were less dramatic

Always measure in production after rollout.

---

## Common Pitfalls

### Assuming "Connected" Is Binary

App checks `isConnected` at launch. Returns true. App proceeds. Connection drops 500ms later during first request.

**Mitigation:** treat every request as potentially failing. Handle failures gracefully regardless of "connected" state. Retry, show loading, fallback to cache.

### Downloading Full-Resolution, Scaling Client-Side

App downloads 4MB photo, resizes to 200x200 thumbnail. 99% of bytes wasted.

**Mitigation:** server-side resizing. CDN variants. Client requests the size it actually needs.

### No Data Saver Mode

App autoplays video on cellular. Uploads HD photos automatically. User is on metered plan.

**Mitigation:** detect metered connection. Respect `Save-Data` header. Provide user-facing toggle.

### Aggressive Prefetching on Cellular

App prefetches next 10 pages of feed "to feel fast." Burns user's monthly data budget on content they never read.

**Mitigation:** prefetch only on WiFi by default. Prefetch only when user is 70%+ through current content. Limit prefetch volume.

### Ignoring 2G Users

Lab tests on 4G and WiFi. Metrics look fine. 2G users have 5-second load times that never surface in dashboards.

**Mitigation:** slice metrics by network type. Set SLOs for worst-case cohorts. Test with network throttling in dev.

### No Connection Migration

WebSocket connection drops when user walks into building, switches to WiFi. App stops receiving messages. User assumes "messaging is broken."

**Mitigation:** QUIC handles this automatically. Otherwise, implement explicit reconnection on IP change detection.

### Exponential Backoff Without Jitter

Service recovers at 3am. All clients hit exactly at backoff interval — service is immediately overwhelmed again.

**Mitigation:** add randomness. `sleep(backoff * random(0.5, 1.5))` — simple, effective.

### Custom Protocols When Standard Would Work

Team builds custom binary protocol "for efficiency." Maintains it for years. Developers new to team struggle. Debugging tools don't work. Hiring is harder.

**Mitigation:** standard HTTPS + Brotli + CDN handles 95% of cases. Custom protocols (FB Lite's) are justified at scale, not at MVP.

---

## Required Behaviors — Templates for Skill Output

When skill produces output for a network-sensitive feature:

| Behavior | Template |
|----------|----------|
| Low-bandwidth operation | `Feature functions on 3G connections (approximately 100-500kbps) with sub-5-second response times (verified by throttled network test)` |
| Data saver respect | `Feature reduces payload size and disables autoplay when Save-Data header or OS metered-connection signal present (verified by metered network test)` |
| Adaptive image quality | `Images served at quality/resolution matched to client's network type (verified by network-type header and returned image bytes)` |
| Retry discipline | `Network failures retry with exponential backoff capped at [N] attempts, then surface error to user (verified by offline-then-online test)` |
| Connection migration | `Persistent connections survive WiFi-to-cellular transitions without user action (verified by network transition test)` |
| Offline graceful | `Feature degrades to cached content on network failure rather than crashing or showing blank UI (verified by airplane-mode test)` |
| Bandwidth measurement | `App tracks bytes transferred per user per day and alerts on regressions (verified by telemetry check)` |
| Payload efficiency | `API responses compressed with Brotli or gzip, reducing wire size by 70%+ on JSON payloads (verified by response header inspection)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions involving network optimization:

```
Transport protocol: HTTP/3 (QUIC) where supported, with HTTP/2 fallback. Rationale: 1-RTT connection establishment, head-of-line blocking elimination, and connection migration improve user experience on cellular and poor networks; 6-20% p90 latency improvement documented in production at Snap. Source: Snap "QUIC at Snapchat."

Image strategy: server-side resizing and format negotiation via CDN. Client sends Accept header and size parameters; server returns WebP (or AVIF for modern clients), quality adjusted by network hint. Rationale: client-side downsampling wastes bandwidth; WebP saves ~25-30% vs JPEG; adaptive quality matches perception to connection capability. Source: Facebook Lite image server architecture.

Adaptive quality tiers: 65% WebP on slow-2G/2G, 75% on 3G, 85% on 4G, 95% on WiFi. Video autoplay on WiFi only. Rationale: aligns transmission cost to user's network capability and implied data budget. Source: Facebook Lite tiered approach.

Compression: Brotli for text payloads (JSON, HTML, CSS, JS), gzip fallback. Rationale: Brotli is 20-30% smaller than gzip for text; universal modern client support. Negligible implementation cost behind a CDN.

Connection management: HTTP/2 or HTTP/3 multiplexed connections with TLS session resumption. Prewarm DNS and TLS on app launch for primary API endpoint. Rationale: connection establishment dominates latency on slow networks; reuse amortizes setup cost.

Retry strategy: exponential backoff with jitter, capped at 5 retries or 5 minutes. Distinguish temporary (5xx, network) from permanent (4xx) errors. Honor Retry-After headers. Circuit breaker on sustained failure to endpoint. Rationale: naive retries worsen outages and drain battery; jitter prevents thundering herd on recovery.

Save-data mode: respect Save-Data HTTP header and OS metered-connection signal. Additionally expose user-facing "Data saver" toggle in app settings. Rationale: users in metered markets actively manage data; defaults must work, user controls allow override.

Bandwidth instrumentation: track bytes-per-user-per-day, p95/p99 latency per network type, error rates sliced by country and device tier. Alert on regressions in low-connectivity cohorts specifically. Rationale: global averages hide emerging-market and low-end-device problems; tail latency matters more than mean for user experience.

Prefetching: only on WiFi or unmetered connections. Threshold: prefetch next page when user reaches 70% of current. Limit to 1-2 concurrent prefetches. Rationale: speculative fetches on cellular waste user data budget; conservative prefetching preserves perceived performance without consumption surprise.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **Target environment is emerging markets or mixed global** → full Lite-pattern discussion, adaptive quality tiers, thin-client evaluation
- **Mobile app with any cellular users** → QUIC, compression, retry discipline, save-data respect, bandwidth instrumentation
- **Media-heavy feature (images or video)** → server-side resizing, WebP/AVIF, adaptive quality, progressive loading
- **Real-time feature on mobile** → QUIC connection migration, reconnection strategy, see also `realtime.md`
- **Developed-markets-only product** → lighter recommendations, but QUIC and compression still apply for free via CDN
- **Internal dashboard or admin tool** → most of this reference doesn't apply; skip network optimization discussion

---

## Invariants

- Payload sizes and image formats match network capability, not hardcoded assumptions
- Retry with exponential backoff and jitter is shipped with first version of any network client
- Metered connections (cellular, roaming, save-data) receive lighter treatment automatically
- Network performance metrics sliced by country, device tier, network type — not just global averages
- Prefetching is off on cellular by default, on on WiFi
- Compression (Brotli or gzip) applied to all text payloads over 1KB
- Custom protocols are justified by documented scale requirements, not speculative efficiency
- QUIC/HTTP3 is default transport where infrastructure supports it