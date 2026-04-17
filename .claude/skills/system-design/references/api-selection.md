# API Protocol Selection

Reference loaded for Integration-heavy features (external APIs, webhooks, third-party sync) or when the feature description names a protocol choice explicitly.

Implementation rules for REST (envelope shape, status codes, idempotency headers, error format, versioning) live in backend rules. This file decides **which protocol** to commit to in the spec.

---

## When Protocol Choice Is a Decision

Choose deliberately when any of these apply:
- First API surface on a new product or subsystem
- External clients consume the API (mobile apps, third-party integrations)
- Multiple protocols are in play (REST + real-time channel, or REST + gRPC internal)
- Real-time requirement exists (see `realtime.md` for transport-only questions)

Skip if the feature reuses an existing API surface under an existing protocol — that's an implementation detail, not an architectural decision.

---

## Protocols

| Protocol | Strengths | Costs | Typical use |
|----------|-----------|-------|-------------|
| **REST** | Universally supported, cacheable, simple tooling, OpenAPI ecosystem | Verbose payloads, over-fetching, N+1 risk with nested resources | Default for most public + private APIs |
| **GraphQL** | Client selects fields, batches related queries, single endpoint | Complex server implementation, caching harder, N+1 moves to resolvers, auth per-field | Data-graph-shaped APIs, heterogeneous clients with different field needs |
| **gRPC** | Binary (small + fast), schema-enforced contracts, bidirectional streaming | Poor browser support (needs gRPC-Web), not human-inspectable, firewall friction | Internal service-to-service, high-throughput backends |
| **Server-Sent Events (SSE)** | Simple, HTTP-native, auto-reconnect, works through proxies | Unidirectional (server→client only), text-only | Live updates where client doesn't need to stream back |
| **WebSocket** | Bidirectional, low-overhead after handshake, binary or text | Stateful connections, load balancing harder, reconnect logic manual, firewall friction | Collaborative editing, chat, games |
| **Long-polling** | Works everywhere, zero infrastructure | Inefficient at scale, poor latency | Last-resort fallback when SSE/WebSocket blocked |

---

## Decision Tree

```
Is this an external-facing API?
├─ Yes
│   ├─ Clients need flexible field selection AND backend can absorb complexity?
│   │   ├─ Yes → GraphQL
│   │   └─ No → REST
│   └─ Default → REST
└─ No (internal service-to-service)
    ├─ High throughput + strict contracts needed?
    │   ├─ Yes → gRPC
    │   └─ No → REST
    └─ Default → REST

Does the feature need real-time push to clients?
├─ Server-to-client only (live feed, notifications, progress updates) → SSE
├─ Bidirectional (chat, presence, collaborative cursors) → WebSocket
├─ Infrequent updates, clients may be behind strict firewalls → Long-polling (with SSE fallback plan)
└─ No real-time push → skip
```

### Default

For a new product API: **REST**. GraphQL and gRPC are justified moves, not defaults. Real-time transports are added alongside REST (not replacing it) when the use case demands.

---

## Trade-offs to Surface

When recommending **REST**, name what it costs:
- Over-fetching on rich resources (mitigated by field selection parameter — implementation rule)
- N+1 requests when clients need related data (mitigated by resource embedding — implementation rule)
- Verbose compared to binary protocols

When recommending **GraphQL**, name what it costs:
- Server implementation complexity (schema stitching, resolver optimization, DataLoader patterns)
- Caching harder (no HTTP-cache-by-URL)
- Per-field auth logic
- Not a fit if clients all need the same fields

When recommending **gRPC**, name what it costs:
- Browsers cannot speak it natively (gRPC-Web is a different thing)
- Harder to debug and test manually
- Firewall and infrastructure friction

When recommending **WebSocket** (over SSE), name what it costs:
- Stateful connections complicate load balancing
- Reconnect + message redelivery logic is manual
- Higher infrastructure cost than SSE at scale

---

## Anti-Patterns

- **GraphQL for everything** — Introducing GraphQL because "it's modern" without the client-diversity or data-shape problem it solves. REST + field selection covers most cases.
- **WebSocket when SSE suffices** — WebSocket picked for live updates that are server→client only. SSE is simpler in every way when bidirectionality is not needed.
- **Multiple protocols without a boundary** — REST + GraphQL + gRPC in one product without a clear rule for when which applies. Every engineer picks differently; maintenance explodes.
- **Version-by-query-param** — `?version=2` or custom `X-Version` header. Use URL path prefix for breaking changes; non-breaking additions don't need versioning.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Protocol consistency | `All API endpoints follow [protocol] conventions (verified by API linting in CI)` |
| Contract stability | `Breaking changes introduce new versioned paths; existing paths remain functional for at least [N] releases (verified by contract test against prior version)` |
| Real-time delivery | `Live events delivered to clients within [N] seconds of server receipt via [SSE/WebSocket] (verified by multi-client integration test)` |

### Architectural Decisions

```
API protocol: REST over HTTPS. Rationale: external clients include mobile apps and third-party consumers; universal tooling and caching outweigh the verbosity cost; no feature requires client-selected field shapes.

Real-time transport: Server-Sent Events for live feed updates. Rationale: server-to-client only (clients don't stream back), simpler than WebSocket, survives HTTP proxies, auto-reconnect is native.

Internal service-to-service protocol: gRPC. Rationale: high-throughput calls between backend services, strict contract enforcement via protobuf, browser incompatibility is not a concern for internal traffic.
```

### Open Questions

```
API surface strategy: single REST API for all clients, or split public (REST) + internal (gRPC)? Trade-off: split reduces external surface and improves internal performance, but doubles contract maintenance.

Real-time fallback: when SSE is blocked by corporate proxies, fall back to long-polling or accept degraded experience? Trade-off: long-polling triples infrastructure cost; degraded experience surfaces as "refresh to see updates" for affected users.
```