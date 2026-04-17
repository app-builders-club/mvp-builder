# Real-time Transport

Reference loaded for Real-time features (chat, live feed, presence, collaboration, notifications).

This file decides **transport mechanism and delivery model**. Connection lifecycle and reconnect details are implementation concerns for mobile and backend rules.

---

## When Real-time Is a Decision

Real-time is a decision when the feature requires information to flow to users without them explicitly requesting it. Categories:

- **Notifications** — user should know about events even when app is backgrounded
- **Live feed / timeline** — new items appear in UI without refresh while app is active
- **Chat / messaging** — low-latency delivery of peer messages
- **Presence** — online status, typing indicators, viewers count
- **Collaboration** — shared document editing, co-browsing, cursor positions
- **Progress** — long-running server operations surfacing updates to the client

Skip this reference if the feature is pull-based (user refreshes or re-enters a screen to see updates).

---

## Transport Options

| Transport | Direction | Connection | Latency | Infrastructure cost |
|-----------|-----------|------------|---------|---------------------|
| **Push notifications** (APNs, FCM) | Server → device OS | Stateless | Seconds | Low — platform handles delivery |
| **Server-Sent Events (SSE)** | Server → client | Persistent HTTP | Sub-second | Moderate — one connection per client |
| **WebSocket** | Bidirectional | Persistent TCP | Sub-second | High — stateful, load-balancer friction |
| **Long-polling** | Server → client (simulated push) | Repeating HTTP | 1–5 seconds | High — re-connection overhead, but works anywhere |
| **Periodic polling** | Client pulls | Stateless | Interval-bound | Scales with clients × frequency |

---

## Decision Tree

```
Does the user need to know about events when app is not running?
├─ Yes → Push notifications (mandatory)
│   └─ When app is active, ALSO need live updates without push throttling?
│       ├─ Yes → Push + SSE/WebSocket combo
│       └─ No → Push alone
└─ No (only while app is open)
    ├─ Traffic is server-to-client only (feed updates, notifications, progress)?
    │   ├─ Yes → SSE
    │   └─ No → WebSocket
    ├─ Infrequent updates, clients may be behind strict firewalls?
    │   └─ Long-polling (as last-resort)
    └─ Updates are tolerable to miss, arrive on next refresh?
        └─ Periodic polling (simplest)
```

### Shortcuts

- Mobile app wanting live updates when active + notifications when not → **Push + SSE**
- Chat or collaborative editing → **WebSocket** (bidirectional is the whole point)
- Live dashboard or activity feed → **SSE**
- Status polling in enterprise environment with proxy issues → **Long-polling**

---

## Delivery Model

Transport chosen — now decide delivery guarantees.

| Model | Guarantee | Use |
|-------|-----------|-----|
| **At-most-once** | Message may be dropped, never duplicated | Ephemeral updates (typing indicator, cursor position) |
| **At-least-once** | Message arrives at least once, may duplicate | Most application events (new message, new feed item) — client dedups by ID |
| **Exactly-once** | Message arrives once, never dropped or duplicated | Financial transactions; hard to achieve end-to-end, usually synthesized from at-least-once + client-side dedup |
| **Ordered** | Messages arrive in send order | Chat (per-conversation), document edits |

Defaults: **at-least-once + client-side ID dedup** for application events. **Ordered-within-partition** when ordering matters (typically per-user or per-conversation).

---

## Reconnection Model

Real-time connections drop. Decide what happens when they reconnect.

- **Last-event-ID** — client remembers the last event received; server replays from there. Fits SSE and WebSocket.
- **Session resume token** — server issues a short-lived token; client presents it on reconnect to resume state. Fits WebSocket for richer session state.
- **Catch-up on reconnect** — client issues a separate REST call to fetch anything missed since disconnect. Fits all transports, separates real-time from recovery.

Default: **at-least-once delivery + client catch-up on reconnect** via REST. Simpler than last-event-ID replay and more robust to server-side event retention limits.

---

## Background / Foreground Transitions

Mobile apps can't hold persistent connections indefinitely in background. Decide what happens at each transition.

- **Foreground → Background:** close the persistent connection. Rely on push notifications for critical updates.
- **Background → Foreground:** reopen the connection. Run a catch-up fetch to reconcile state.
- **Never assume continuity** — mobile OS may kill the connection, process, or app at any moment.

---

## Anti-Patterns

- **Polling where push suffices** — client-originated loops consume battery, waste requests, introduce latency.
- **WebSocket when SSE suffices** — bidirectional when all traffic is one-way. Pays infrastructure cost for zero benefit.
- **No reconnection plan** — works in development, fails the first time a real user's network blips.
- **No client-side dedup** — at-least-once delivery guarantees duplicates eventually. Without dedup, users see the same chat message twice.
- **Relying on WebSocket for critical notifications** — if the connection is down, the user misses the event. Push is the mandatory reliable channel for out-of-app events.
- **No backpressure** — server streams updates faster than client can consume. Client queue grows until crash.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Live delivery | `New [event type] appears in UI within [N] seconds of server receipt without user action (verified by multi-client integration test)` |
| Out-of-app delivery | `User receives notification of [event type] via OS push when app is not running (verified by backgrounded-device test)` |
| Reconnect recovery | `Client reconciles missed events after network interruption without requiring manual refresh (verified by disconnect-reconnect test)` |
| Duplicate suppression | `Client never shows the same event twice across reconnects or retries (verified by replay integration test)` |

### Architectural Decisions

```
Real-time transport: Server-Sent Events for in-app live updates, push notifications for out-of-app delivery. Rationale: server-to-client traffic only, so SSE's simplicity wins over WebSocket; push is mandatory for events users must know about when app is backgrounded.

Delivery model: at-least-once with client-side dedup by event ID. Rationale: exactly-once over a network is intractable without prohibitive cost; dedup by ID is cheap and eliminates the user-visible duplication problem.

Reconnection: client issues a REST catch-up call on reconnect (not event replay). Rationale: decouples live transport from recovery logic; simpler server implementation; robust to arbitrarily long disconnects.
```

### Open Questions

```
Push vs in-app-only for live updates: add push for events that happen while the app is active, or suppress? Trade-off: push ensures delivery even if WebSocket/SSE drops; suppression avoids noisy duplicate alerts.

Event retention window: how long does the server keep events for catch-up replay? Trade-off: longer window supports longer disconnects but costs storage; shorter window forces full re-fetch after extended offline periods.
```