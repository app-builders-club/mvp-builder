# Real-Time Transport Selection

Reference for choosing between WebSocket, SSE, MQTT, long polling, gRPC streaming, and push notifications. Loaded when triage identifies Real-time features (chat, live feeds, presence, notifications, collaboration) or when the feature description mentions "live updates" or "without refresh."

Grounded in Instagram's published architecture for Direct Messages (MQTT on mobile, WebSocket on web, Mutation Manager for optimistic state), plus generally accepted patterns for each transport type.

---

## Transport Options Overview

Six transports cover the real-time landscape. Each has a clear zone of applicability.

| Transport | Direction | Best for | Avoid when |
|-----------|-----------|----------|------------|
| **Short polling** | Client pulls | Simple updates, very low message volume | Real-time feel matters, high user counts (battery/cost) |
| **Long polling** | Client pulls (held open) | REST-like APIs needing near-real-time, simple infrastructure | Sub-second latency required, large fanouts |
| **SSE** | Server pushes (one-way) | Server-to-client streams, standard HTTP infra, simple fallback | Client needs to stream back to server |
| **WebSocket** | Bidirectional | Chat, collaboration, anything with client-to-server streaming | HTTP caching/proxies are important, simple use cases |
| **MQTT** | Bidirectional (pub/sub) | Mobile messaging at scale, battery-efficient persistent connections | Web browsers (partial support), teams without broker infrastructure |
| **gRPC streaming** | Bidirectional | Internal services, strongly-typed streams, polyglot systems | Client-facing (browsers need grpc-web gateway), simple use cases |
| **Push notifications** | Server pushes (OS-level) | Backgrounded apps, notification-style updates, offline users | Real-time in-app updates (use alongside, not instead of) |

---

## Short Polling

```
Client: GET /messages/new
Server: { messages: [] }
(wait N seconds)
Client: GET /messages/new
Server: { messages: [new_msg] }
```

Client asks for updates on a fixed interval.

### When acceptable

- **Prototype / MVP** where real-time isn't yet a product requirement
- **Very low user counts** (under ~100 concurrent) — polling cost stays manageable
- **Updates are rare** — most requests return nothing, bandwidth is tolerable
- **Admin tools or dashboards** where 30-second freshness is fine

### When to avoid

- **Mobile apps.** Each poll wakes the radio, drains battery, consumes cellular data. User-hostile.
- **Real-time feel.** Even 5-second polling has perceptible lag. Users describe it as "laggy" not "real-time."
- **Large user bases.** Polling cost scales linearly with users × poll frequency. 100k users polling every 5s = 20k RPS on your server for (usually) no new data.

### Poll Interval Heuristic

- Every 30–60s for mobile background (battery permitting)
- Every 5–15s for web foreground
- Never faster than 1s (becomes de-facto busy-wait)

Always consider long polling, SSE, or WebSocket before reaching for faster poll intervals.

---

## Long Polling

```
Client: GET /messages/wait (timeout: 30s)
Server: (holds connection open until message arrives or timeout)
Server: { messages: [new_msg] }
Client: GET /messages/wait (immediately)
```

Client opens a request; server holds it until data arrives or timeout fires.

### When acceptable

- **Upgrade path from short polling** when simple infrastructure matters
- **Existing HTTP stack** where WebSocket gateway is a heavy lift
- **Low-to-moderate concurrency** (hundreds to low thousands of concurrent connections per server)

### Trade-offs

- **Better than short polling** — no wasted requests when nothing's happening, latency is connection-to-event time
- **Still consumes server connections** — each waiting client holds a thread/goroutine/socket
- **Less efficient than SSE or WebSocket** — each message closes and reopens the connection

### When to migrate off

- Concurrency grows past a few thousand simultaneous long-polls
- Need for client-to-server streaming
- Multi-second latency becomes user-visible

---

## Server-Sent Events (SSE)

```
Client: GET /events
Server: Content-Type: text/event-stream
        data: { message: "..." }
        data: { message: "..." }
        ...
```

Standard HTTP endpoint that streams events until closed. One-way — server to client only.

### When SSE is the right choice

- **Server-to-client only.** Live feed updates, notifications, progress streams, stock tickers. If clients don't need to push back through the same channel, SSE is simpler than WebSocket.
- **Standard HTTP infrastructure.** SSE works through standard reverse proxies, CDNs, load balancers without special configuration. WebSocket often requires infrastructure changes.
- **Automatic reconnection.** Browser `EventSource` API handles reconnection automatically. WebSocket requires explicit reconnection logic.
- **Simplicity over sophistication.** SSE payloads are text/event-stream — trivially debuggable with cURL.

### When SSE falls short

- **Bidirectional communication** — collaborative editing, chat with typing indicators, anything where client needs to stream to server. WebSocket required.
- **Binary data** — SSE is text-only. For binary streams use WebSocket.
- **High connection limits on browsers** — browsers limit ~6 simultaneous connections per domain. SSE connections count against this.

### When to apply

Anywhere in the decision tree you reach "server pushes to client, client doesn't need to push back" — check SSE first before reaching for WebSocket.

---

## WebSocket

Full-duplex persistent connection over HTTP upgrade.

### When WebSocket is the right choice

- **Bidirectional streaming.** Chat with typing indicators, collaborative editing, live multiplayer.
- **Binary payloads.** Voice, video, compressed game state.
- **Low-latency requirements** — sub-100ms message delivery.
- **Sophisticated event patterns** — client needs to subscribe/unsubscribe to topics dynamically.

### Infrastructure cost

- Standard reverse proxies often need configuration for WebSocket support
- Load balancers need session affinity (sticky sessions) — a user's messages route back to their connected server
- Scaling horizontally requires a fanout layer (Redis pub/sub, Kafka, or a dedicated message bus) so a message received on server A reaches a user connected to server B
- Connection limits per server — typically 10k–100k concurrent connections, depending on memory and network tuning

### Reconnection Strategy

WebSocket drops happen constantly — network switches, proxy timeouts, server restarts. Client must:
- Detect disconnection (ping/pong, or TCP RST)
- Reconnect with exponential backoff
- On reconnect, fetch missed messages via REST fallback (don't assume WebSocket alone delivered all messages)
- Queue outgoing messages locally while disconnected, flush on reconnect

### When to apply

- **Chat / messaging** where both directions matter
- **Live collaboration** (cursors, shared editing)
- **Real-time dashboards with filters** that users adjust dynamically
- **Gaming** and real-time sync requirements

---

## MQTT — Instagram's Choice for Mobile

MQTT (Message Queuing Telemetry Transport) is a pub/sub protocol designed for constrained devices. Meta uses it for Instagram Direct on mobile.

### Why Instagram Chose MQTT for Mobile

Meta's public architecture for Instagram Direct uses MQTT on mobile clients specifically. The reasons documented in Meta's engineering blogs:

- **Persistent connection designed for low power.** MQTT was originally designed for IoT sensors on limited battery. Long-running connections with minimal overhead — ideal for always-connected mobile apps.
- **Pub/sub semantics match messaging use case.** Users subscribe to their own inbox topic plus group topics. Server publishes to the topic; all subscribed clients receive.
- **Built-in QoS levels** (at-most-once, at-least-once, exactly-once) — can pick per-message delivery guarantees without rebuilding protocol.
- **Small packet headers.** MQTT has a 2-byte fixed header. JSON-over-WebSocket has hundreds of bytes of overhead per message. At Instagram's scale, this matters.
- **Broker-based fanout built-in.** Pub/sub topology scales natively — brokers route messages without application-level fanout logic.

### Why Instagram Uses WebSocket for Web

Instagram's desktop messaging launch post notes that WebSocket was used for web. Mobile MQTT libraries don't translate well to browsers (no native MQTT support; polyfills are heavy and buggy). WebSocket is the browser-native equivalent of persistent bidirectional connection.

**Pattern:** pick transport per platform. Mobile and desktop can use different transports behind a unified server-side messaging layer.

### When MQTT is the right choice

- **Mobile-first messaging apps** at significant scale (millions of concurrent connections)
- **IoT and device telemetry** (MQTT's origin domain)
- **Battery efficiency matters materially** (pub/sub overhead is lower than WebSocket message framing)
- **Team has infrastructure capacity** — MQTT brokers (HiveMQ, EMQX, AWS IoT, Mosquitto) are another piece of infrastructure to operate

### When MQTT is overkill

- **MVP scale** — fewer than ~100k concurrent mobile connections. WebSocket is simpler, infrastructure costs dominate transport efficiency at small scale.
- **Web-primary products** — MQTT doesn't fit browsers naturally.
- **Teams without pub/sub broker experience** — MQTT adds operational complexity that WebSocket doesn't.

---

## gRPC Streaming

gRPC supports server-streaming, client-streaming, and bidirectional streaming via HTTP/2.

### When gRPC streaming is the right choice

- **Internal service-to-service real-time.** Microservice A streaming events to microservice B. Strongly typed via protobuf.
- **Polyglot systems** — gRPC clients generated from `.proto` schemas in every language.
- **Low-latency internal paths** — binary protocol, HTTP/2 multiplexing.

### Where gRPC streaming fails

- **Browser clients** — no native HTTP/2 trailers support. Need `grpc-web` gateway that adds operational overhead.
- **Mobile clients** — works, but MQTT or WebSocket are more standard for mobile messaging.
- **Public APIs** — developers outside your org don't want to generate gRPC clients.

### When to apply

- **Internal real-time service communication** — yes
- **Client-facing real-time** — almost never

For MVP Builder projects, gRPC streaming is usually out of scope.

---

## Push Notifications — The Fallback Layer

Push notifications aren't a real-time transport — they're a parallel channel for reaching users when the real-time transport is unavailable.

### Role in Real-Time Architecture

Real-time transports work when the app is in foreground and connected. Push notifications handle:
- **App backgrounded** — OS wakes app briefly via APNs (iOS) or FCM (Android)
- **App killed** — OS displays notification even without app running
- **Device offline** — notification queues and delivers on next connection

Every real-time messaging app has both: persistent connection for in-app real-time, plus push for everything else.

### Delivery Characteristics

- **Best-effort only.** APNs and FCM do not guarantee delivery. A notification may be dropped.
- **Batching and throttling.** OS may coalesce multiple notifications or delay delivery to save battery.
- **Silent pushes** wake the app briefly for background refresh — limited in frequency, OS-enforced budgets.
- **Rich pushes** carry attachments, actions, but with size limits (~4KB payload).

### Integration with Real-Time

Typical pattern:
1. User receives message → server tries WebSocket/MQTT delivery first
2. If delivery fails (connection not established, offline), server sends push via APNs/FCM
3. Push contains message preview (text) plus metadata (message ID, thread ID)
4. On open, app fetches full message via REST using metadata from push
5. App reopens persistent connection, syncs any missed messages

### When to apply

Every mobile app doing real-time needs push notifications as fallback. Not optional.

---

## Optimistic State: The Mutation Manager Pattern

Real-time transports handle delivery. Optimistic state handles user perception.

### The Problem

User sends a message. Even on WebSocket, round-trip to server takes 100–500ms. Without optimistic UI, the message appears after 500ms. Users perceive this as slow.

Optimistic state: show the message immediately in the sender's UI. Treat the server response as confirmation or retry trigger.

### Instagram's Mutation Manager (DMM)

Instagram Engineering published the pattern they use for Direct: "Direct's Mutation Manager" (DMM). The documented architecture:

1. **Centralized mutation service.** All state-changing operations go through DMM, not direct API calls.
2. **Disk-persisted queue.** Mutations saved to disk before network attempt. Survives app crashes and restarts.
3. **OptimisticState cache.** Pending mutations stored separately from server state. UI renders merged view.
4. **Order preservation.** DMM sends mutations in the order they were queued. Users expect messaging operations to apply in order they initiated.
5. **ViewModels merge state.** UI doesn't read raw server data — it reads ViewModels that merge published server state with pending optimistic entries.

The pattern works across every real-time surface at Instagram — sending messages, marking as read, reactions.

### Why centralize mutations

- **Retry logic in one place.** Every mutation has the same retry behavior. No ad-hoc implementations per feature.
- **Order preserved even across crashes.** Disk persistence means the queue survives.
- **Optimistic state management is consistent.** UI layer has one source of truth for pending state.
- **New mutations are fast to add.** Compiler guides you — "what's the network payload, what's the optimistic entry." Team scales.

### When to apply this pattern

- **Any app with real-time mutations that must feel instant.** Messaging, collaboration, social feeds with likes/comments.
- **Any app where users notice request latency.** Which is every user-facing app.

Don't reinvent ad-hoc optimistic state per feature. Centralize from day one.

---

## Delivery Guarantees

Every real-time message has a delivery guarantee — explicitly chosen or accidentally inherited.

### At-Most-Once

Message delivered zero or one times. Dropped messages are acceptable.

- **Suitable for:** presence indicators (who's online now), typing indicators, live stats, stock tickers
- **Not suitable for:** messages, critical notifications, financial updates

### At-Least-Once

Message delivered one or more times. Duplicates possible, must be handled by receiver.

- **Suitable for:** most messaging, notifications, events
- **Requires client-side deduplication** — messages carry unique IDs, client ignores duplicates

### Exactly-Once

Message delivered exactly once. Requires coordination (two-phase commit, idempotent processing, or transactional delivery).

- **Suitable for:** payments, one-time events, actions with real-world side effects
- **Expensive** — usually achieved by at-least-once delivery plus idempotency keys

Most messaging systems use at-least-once + idempotency. Design for duplicates.

---

## Connection Management

Real-time transports all share connection lifecycle concerns.

### Reconnection

- **Exponential backoff** on reconnect attempts. Start 1s, double to cap at 30–60s.
- **Jitter** on backoff to prevent thundering herd when server recovers.
- **Never block UI** on reconnection attempts. App stays usable in offline-degraded mode.

### Heartbeats

- Long-lived connections die silently when an intermediate proxy times out
- Client sends ping every 30–60 seconds to keep connection alive and detect dead connections
- WebSocket has native ping/pong. MQTT has its own keepalive. SSE relies on regular events or custom ping messages.

### Battery Impact

- Persistent connection = radio active = battery drain on mobile
- Mitigations:
  - Disconnect when app backgrounded, rely on push notifications
  - Reduce keepalive frequency in background
  - Use MQTT's battery-aware design over ad-hoc WebSocket
- Monitor real-world battery impact in production — profiling on dev devices misses user patterns

### Scale Fanout

- Single message → N recipients → N outbound deliveries
- For large groups (thousands of recipients), fanout moves from "for each recipient send directly" to "publish once to broker, broker handles subscriptions"
- Pub/sub brokers (Redis, Kafka, NATS, MQTT broker) are the usual infrastructure answer

---

## Common Pitfalls

### Choosing WebSocket Before Confirming SSE Is Insufficient

Default assumption "real-time = WebSocket" skips the simpler option. Most update streams are server-to-client only. SSE is almost always simpler for one-way streams.

**Mitigation:** ask "does the client need to push back through this channel?" If no, try SSE first.

### No Push Notification Fallback

App uses WebSocket for messaging. When backgrounded, WebSocket closes. User receives messages only when they manually reopen app. Competitors (WhatsApp, Telegram) deliver instantly via push.

**Mitigation:** always pair persistent connection with push notifications. Push for background/offline, connection for foreground real-time.

### Ad-Hoc Optimistic State

Every feature implements its own optimistic UI logic. Some have retry, some don't. Some persist across app restart, some don't. Inconsistent UX.

**Mitigation:** centralize mutations through a single service (Instagram's DMM pattern). Every feature gets retry, persistence, ordering for free.

### Short Polling at Scale

Team assumes short polling is fine because "updates aren't that real-time." At 100k users polling every 10 seconds, that's 10k RPS of (mostly empty) requests. Server costs balloon. Mobile battery complaints arrive.

**Mitigation:** long polling or SSE before considering polls faster than 30 seconds. Real-time transports before considering polls faster than 10 seconds.

### WebSocket Without Reconnection Logic

Client opens WebSocket on app start. Proxy times out after 5 minutes of idle. Client doesn't detect dead connection. User sees "stuck" messages that never send.

**Mitigation:** heartbeat + reconnection logic from day one. Never ship a WebSocket client without both.

### At-Most-Once Delivery on Messages

Team picks lightweight at-most-once for simplicity. Occasionally a message drops. Users report "my message didn't send" — catastrophic for messaging UX.

**Mitigation:** at-least-once + idempotency keys. Duplicate delivery is recoverable; lost delivery is not.

### End-to-End Encryption Without Architecture Planning

Team adds E2E encryption to existing server-side processing (spam detection, search, content moderation). Server can't decrypt. Features break.

**Mitigation:** plan E2E encryption at architecture stage. Client-side implementations of anything server-side used to do (spam detection, search index, reactions that aggregate by emoji).

---

## Required Behaviors — Templates for Skill Output

When skill produces output for a real-time feature, these behavior templates apply:

| Behavior | Template |
|----------|----------|
| Real-time delivery latency | `New [message type] appears in recipient UI within [N] seconds of server receipt without user action (verified by multi-client integration test)` |
| Connection recovery | `Client automatically reconnects after network interruption within [N] seconds (verified by network disconnection test)` |
| Missed message sync | `Client fetches messages received during disconnection on reconnection (verified by offline-period test)` |
| Optimistic send | `Sent [messages] appear immediately in sender UI before server confirmation (verified by latency measurement with throttled network)` |
| Send retry | `Sent [messages] retry automatically on network failure and deliver once connectivity restored (verified by offline-then-online test)` |
| Send ordering | `Messages appear to recipient in the order sender queued them (verified by rapid-send test)` |
| Push fallback | `User receives notification when [event] occurs while app is backgrounded or killed (verified by backgrounded push test)` |
| Duplicate handling | `Duplicate delivery of same [message ID] results in single UI appearance (verified by duplicate injection test)` |
| Battery impact | `Persistent connection consumes less than [N]% battery per hour in foreground (verified by battery profiling)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions for a real-time feature:

```
Real-time transport (mobile): MQTT with broker fanout. Rationale: persistent connection with battery-efficient design, pub/sub semantics match messaging topology, small packet headers reduce cellular data. Source: Instagram Direct mobile architecture.

Real-time transport (web): WebSocket. Rationale: browsers lack native MQTT support, WebSocket is native browser equivalent. Shared server-side messaging layer routes between transports. Source: Instagram desktop messaging launch.

Real-time transport: Server-Sent Events for live updates, REST for user actions. Rationale: updates flow server-to-client only (no client streaming), SSE works through standard HTTP infrastructure, auto-reconnection via EventSource API simpler than WebSocket reconnection. Source: general SSE pattern for unidirectional real-time.

Real-time transport: Short polling every 15 seconds. Rationale: MVP stage with under 1k concurrent users, real-time feel not critical, simplest infrastructure. Plan: upgrade to SSE or WebSocket when concurrent users exceed 10k or latency becomes user-visible.

Push fallback: APNs and FCM for backgrounded and offline delivery. Server attempts persistent-connection delivery first, falls back to push on failure or when client not connected. Rationale: standard mobile real-time pattern; persistent connection alone misses backgrounded app users.

Optimistic state: centralized Mutation Manager service. All mutations queued through manager with disk persistence, order preservation, and automatic retry. UI reads merged ViewModels (server data + pending mutations). Rationale: ad-hoc optimistic state leads to inconsistent UX and redundant retry implementations per feature. Source: Instagram Direct Mutation Manager pattern.

Delivery guarantee: at-least-once with client-side deduplication via message IDs. Rationale: lost messages are unacceptable for messaging UX; duplicates are recoverable with idempotent handling.

Connection management: heartbeat every 30 seconds, exponential backoff reconnection (1s → 2s → 4s → ... → 60s cap) with jitter. Rationale: proxies silently drop idle connections; reconnection without backoff thundering-herds server during recovery.

Scale fanout (large groups): Redis pub/sub (or Kafka for durability) between application servers. Rationale: direct per-recipient delivery doesn't scale past a few hundred per message; pub/sub broker handles topic subscriptions natively.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **User described messaging or chat** → evaluate MQTT (mobile scale) vs WebSocket (simpler, web-compatible), always pair with push fallback, apply Mutation Manager pattern
- **User described live feed or notifications (one-way)** → SSE is first choice, fall back to WebSocket only if browser limits matter
- **User described collaborative editing** → WebSocket required (bidirectional, low-latency)
- **User described presence indicators (who's online)** → at-most-once delivery OK, SSE or lightweight WebSocket sufficient
- **User described live dashboards** → SSE fits most cases; WebSocket only if users adjust subscriptions dynamically
- **User described internal service-to-service streaming** → gRPC streaming
- **User at MVP scale with low user counts** → short polling or long polling acceptable, document upgrade path
- **User mentioned "sub-second updates" or "real-time collaboration"** → WebSocket, careful connection management, broker fanout for scale

---

## Invariants

- Every real-time mobile feature pairs a persistent transport with push notifications — not optional
- Optimistic state is centralized through a mutation manager, not ad-hoc per feature
- Delivery guarantees are explicit decisions, not inherited from transport defaults
- Reconnection and heartbeat logic shipped with first version of any persistent-connection client
- At-least-once + idempotency is the default for messages; at-most-once only for ephemeral signals (presence, typing)
- Transport can vary per platform (mobile MQTT + web WebSocket) behind a unified server messaging layer
- Battery impact is measured in production, not assumed from dev device profiling