# API Protocol Selection

Reference for choosing between REST, GraphQL, gRPC, and Server-Driven UI (SDUI) approaches. Loaded when triage identifies Integration-heavy features or when the feature involves significant client-server data exchange.

This reference grounds protocol decisions in published engineering outcomes from Airbnb (GraphQL at scale), Slack (API design principles and specific case studies of API evolution), and common patterns documented by gRPC and SDUI practitioners. Use these as ground truth for trade-off analysis.

---

## Protocol Overview

Four protocol approaches dominate modern system design. Each has clear zones of applicability.

| Protocol | Best for | Avoid when |
|----------|----------|------------|
| **REST** | Standard CRUD, public APIs, simple integrations, teams without GraphQL experience | Multiple client types with divergent data needs, deeply nested data requiring many round-trips |
| **GraphQL** | Multiple clients (web/iOS/Android) with different data needs, heavily-nested UIs, frequent client iteration | Simple CRUD, external-facing public APIs, teams without GraphQL infrastructure experience |
| **gRPC** | Internal service-to-service, performance-critical, strongly-typed contracts, bi-directional streaming | Public-facing APIs, browser clients without grpc-web gateway, feature velocity matters more than performance |
| **SDUI** | Server-controlled UI, heavy A/B testing, frequent UI iteration without app releases | Apps where user-perceived performance is critical (SDUI adds a server dependency for layout) |

These are defaults, not rules. The sections below cover when to deviate.

---

## REST: The Default

REST over HTTP remains the right choice for most MVPs. Before choosing anything else, confirm REST is insufficient — not assumed insufficient.

### Why REST Wins for Most Cases

- Universal tooling: every language, every framework, every HTTP client supports it
- Cachable at every layer: CDN, reverse proxy, browser — all speak HTTP caching natively
- Discoverable: developers read endpoint URLs and infer resources
- Debuggable: cURL, browser DevTools, Postman, tcpdump all work
- Hiring: every backend engineer knows REST; GraphQL specialists are a narrower pool

### REST Best Practices

The canonical REST patterns — HTTP methods, status codes, resource naming, envelope format, idempotency keys — are documented in `backend.md`. That rule file is the single source of truth for REST conventions in MVP Builder projects.

This reference focuses on *when to choose REST* versus alternatives, not *how to implement it*.

### Where REST Falls Short

Four scenarios where REST starts to feel inadequate:

1. **Multiple clients with divergent data needs.** Mobile wants compact payloads; web dashboard wants everything at once. REST forces choosing between under-fetching (clients make many calls) or over-fetching (all clients pay for heaviest consumer's needs).

2. **Deeply nested UIs.** A product detail page needs product + reviews + inventory + related items + seller info. With REST, this is 5 sequential requests or one mega-endpoint that couples unrelated concerns.

3. **Rapid client iteration.** Every new screen needs a new endpoint. Backend becomes a bottleneck for frontend velocity.

4. **Client-side joins.** Fetching list of orders, then for each order fetching customer, then for each customer fetching address. N+1 over the network.

These pressures push teams toward GraphQL. None of them matter for a CRUD app with a single client.

### When to apply REST

- MVP with single client (web OR mobile, not both mature yet)
- Standard CRUD resources
- External / public-facing API (stability and universal tooling matter)
- Team without GraphQL experience and no dedicated platform engineering
- Integration with third parties who expect REST

---

## GraphQL: When Client Diversity Forces It

GraphQL becomes the right choice when REST's limitations actively cost your team velocity. Airbnb's adoption demonstrates this clearly.

### Airbnb's Experience

Airbnb runs GraphQL via Apollo across web, iOS, and Android. The stated outcome: "10x faster at scale." The actual mechanism behind that number, per Airbnb's engineering write-up:

- **90% of productivity gains come from Apollo tooling, not GraphQL itself.** Automated TypeScript/PropTypes generation from schema. Automatic mock data extraction. Schema-aware linting in VS Code. Screenshot testing on changed components.
- **Schema fragments colocated with components.** Each UI section declares its own data needs. Changing a single component updates queries up the hierarchy automatically.
- **Lazy-loaded backend-driven UI.** Pages are a list of "sections" returned by server. Each section has its own schema fragment. Server can change section order, add/remove sections, without client release.

The infrastructure commitment is real: Apollo Server (called "Niobe" at Airbnb), schema stitching across services, Apollo CLI in CI, schema tags for branch-based development, codegen as part of the build.

**Key quote from Airbnb:** "90% of the heavy lifting in the demo was managed by Apollo's CLI tooling." The productivity is in the ecosystem, not the query language.

### When GraphQL Makes Sense

- **Three or more clients** (iOS, Android, web) with divergent data requirements
- **Frequent UI iteration** where backend evolves alongside frontend
- **Platform team exists** or will exist to maintain GraphQL infrastructure
- **Backend is a composition layer** over multiple services — GraphQL gateway naturally emerges
- **Mobile performance matters** and REST over-fetching is measurably slow

### When GraphQL Is a Trap

- **Single client MVP.** All the tooling investment pays back only when multiple clients share the schema.
- **No platform engineering capacity.** Apollo Server, schema composition, codegen pipelines — someone needs to own these.
- **External public API.** GraphQL on public APIs is operationally harder: no HTTP-level caching, rate limiting is per-query not per-endpoint, authorization is per-field rather than per-endpoint. GitHub and Shopify make it work at substantial cost; smaller teams struggle.
- **Strongly CRUD-shaped data.** If your API is `create/read/update/delete` over a dozen resources, REST is simpler.

### GraphQL Implementation Sketch

If choosing GraphQL, the minimal viable setup:

- Single GraphQL endpoint (`POST /graphql`)
- Apollo Server or equivalent
- Schema file as source of truth, versioned in git
- Client-side codegen (Apollo CLI, graphql-codegen)
- DataLoader pattern for batching resolvers (avoid N+1 in the resolvers)
- Persisted queries for production (whitelist of known queries, reduces attack surface and payload size)

### When to apply

- Prefer REST for MVP. Migrate to GraphQL later if client diversity and iteration velocity justify it.
- If committing to GraphQL from day one, confirm platform engineering capacity exists — the tooling is where the value lives.

---

## gRPC: Internal Services, High Performance

gRPC is binary protocol buffers over HTTP/2. Strongly-typed contracts, streaming, code generation. Much faster than JSON REST. Almost never the right choice for MVP product APIs.

### Where gRPC Belongs

- **Internal service-to-service communication.** Microservices calling each other. Binary protocol, HTTP/2 multiplexing, 5-10x smaller payloads than JSON.
- **Performance-critical paths.** Real-time, high-volume data (ads serving, trading, gaming backends).
- **Strongly-typed cross-language contracts.** Protobuf schemas generate clients in every language. No JSON schema drift between services.
- **Bi-directional streaming.** gRPC supports server-streaming, client-streaming, and bidi-streaming natively.

### Where gRPC Fails

- **Browser clients.** gRPC requires HTTP/2 features browsers don't fully expose. `grpc-web` gateway bridges this but adds operational complexity.
- **Public APIs.** Developers outside your org don't want to install protoc and generate clients. REST wins on accessibility.
- **Small teams.** Protobuf tooling, schema evolution rules, backwards/forwards compatibility discipline — this is infrastructure to maintain.

### When to apply

- **Internal microservices:** yes, gRPC is often the right choice once you have 3+ services.
- **Mobile clients talking to your backend:** almost never. REST or GraphQL is simpler.
- **Browser clients:** essentially never (via `grpc-web` only if you truly need it).

For MVP Builder projects, gRPC is usually out of scope — MVPs rarely have the microservice architecture that justifies it.

---

## Server-Driven UI (SDUI)

SDUI is not strictly an API protocol — it's a pattern where the server returns UI structure, not just data. The client renders whatever the server sends.

This pattern is covered in detail in `references/server-driven-ui.md`. This section covers only the protocol-level implications.

### Protocol Shape

SDUI responses typically look like this:

```json
{
  "sections": [
    { "type": "hero", "props": {...} },
    { "type": "product_list", "props": {...} },
    { "type": "review_summary", "props": {...} }
  ]
}
```

Client maintains a mapping from `type` to component. Renders each section with provided props.

The underlying protocol is usually REST or GraphQL returning this shape. SDUI is a *payload pattern*, not a separate protocol.

### When SDUI Interacts with Protocol Selection

- If using SDUI, GraphQL fits particularly well — each section component declares its own query fragment (Airbnb's approach)
- SDUI over REST works but requires discipline on payload shape
- SDUI over gRPC is possible but unusual — SDUI typically serves UI clients, not service-to-service

For the detailed SDUI decision framework (when it's worth it, what the trade-offs are, case studies from Airbnb/DoorDash/Instacart), see `references/server-driven-ui.md`.

---

## Universal API Design Principles

Regardless of protocol, certain principles apply. Slack codified these in their published API guidelines, derived from concrete failures and lessons at scale.

### 1. Do One Thing Well

Each endpoint has one clear purpose. When APIs try to do too much, they become hard to scale, hard to secure, and hard to evolve.

**Case study (Slack):** `rtm.start` returned a WebSocket URL *plus* team info, channels, and members. As teams grew, payload became unwieldy. Most developers only wanted the WebSocket URL. Slack introduced `rtm.connect` that returns *only* the URL. Smaller, faster, doesn't crumble under large teams.

**Application:** when designing an endpoint, ask what a consumer minimally needs. Split when one endpoint serves multiple unrelated use cases.

### 2. Fast Time-to-First-Hello-World

Developers should make their first successful API call in under 15 minutes. If onboarding takes hours, adoption suffers.

**Application:** documentation with copy-pasteable examples. Interactive API explorers (Slack uses an in-browser tester). Sample code in multiple languages. Getting-started guides that lead to a working call in minutes.

This matters for both public APIs and internal APIs consumed by other teams.

### 3. Intuitive Consistency

Developers should guess parts of the API without reading documentation. Three layers:

- **Consistency with industry standards.** Use HTTP verbs correctly. Use conventional status codes. Don't invent your own patterns where standards exist.
- **Consistency with your product.** Field names match product terminology. Don't abbreviate or use jargon. Prefer `user_display_name` over `uname`.
- **Consistency with your other APIs.** Same concept, same name, everywhere. If one endpoint uses `created_at`, don't use `timestamp` elsewhere.

**Application:** maintain an internal style guide. Review new endpoints against the guide. Accept occasional imperfect-but-consistent choices over one-off "better" designs.

### 4. Meaningful Errors

Bad error messages kill adoption. Developers get stuck, give up, and move on.

Good errors are:
- **Easy to understand** — human-readable description
- **Unambiguous** — clear which error this is, not "something went wrong"
- **Actionable** — tell the developer what to do next

**Application:**
- Return both a machine-readable error code (`invalid_auth`) and a human-readable description
- Don't leak implementation details in errors (stack traces, internal service names)
- Don't swallow errors in SDKs — always expose the raw response to the developer
- Link to documentation for complex errors

### 5. Design for Scale and Performance

Three specific practices:

- **Paginate big collections.** Always. Even if you "know" the collection will be small, assume it won't be. Define rational upper bounds from the start.
- **Do not nest big collections inside big collections.** Pagination becomes intractable.
- **Rate limit your API.** One misbehaving client should not degrade service for everyone.

**Case study (Slack):** `channels.list` returned channels *plus all members of each channel*. Worked fine when teams were small. Broke catastrophically at scale. Slack split into `conversations.list` and `conversations.members` — two separate paginated endpoints.

**Application:** pagination is covered in `references/pagination.md`. Rate limiting belongs in `backend.md` infrastructure decisions.

### 6. Avoid Breaking Changes

What worked yesterday should work tomorrow. Every change should be additive when possible.

Breaking changes to consider:
- Removing an endpoint or field
- Changing the type of a field (`string` → `object`)
- Changing the semantics of a field (unit changes, meaning changes)
- Adding required parameters
- Changing error codes

Non-breaking changes (safe):
- Adding new endpoints
- Adding new optional parameters
- Adding new fields to responses
- Adding new error codes (if clients handle unknown codes gracefully)

**Application:** when a breaking change is truly necessary, version the API path (`/v2/`) and run old version in parallel for a documented deprecation window. Communicate in advance. Have a rollback plan.

---

## API Design Process

Slack's review process for new public APIs has four stages. Adaptable to any team.

### 1. Write a Spec

Before coding, write the spec. Include:
- Method/endpoint names
- Purpose (what problem it solves)
- Example request
- Example response
- Possible errors with codes and descriptions

Spec is the central artifact everyone aligns against.

### 2. Internal Review

Share spec with a diverse cross-functional group *before* implementation:
- Other engineers
- Product management
- Developer relations / advocacy
- Security
- Support

Questions to ask:
- Is this consistent with existing APIs?
- Are the naming and structure intuitive?
- Will this scale when payloads grow?
- What's the error handling story?

### 3. Early Partner Feedback

If this is a public API, share the draft with a few trusted early adopters. Real consumer perspective catches issues that internal review misses.

### 4. Beta Testing

Release to limited early-access audience before general availability. Collect feedback, fix issues, only then open to everyone.

### When to apply

- **Public APIs**: always. Full process.
- **Internal APIs consumed by multiple teams**: steps 1 and 2 at minimum.
- **Single-team private APIs**: step 1 (spec) if complex. Skip review otherwise.

---

## Decision Tree

Use this to navigate protocol selection based on dialogue answers.

```
Is this an internal service-to-service API?
├─ Yes → Is performance critical (>10k RPS)?
│         ├─ Yes → gRPC
│         └─ No → REST
└─ No (client-facing) →
   ├─ Multiple client platforms with divergent data needs (web + iOS + Android)?
   │   ├─ Yes → Is platform engineering capacity available?
   │   │         ├─ Yes → GraphQL
   │   │         └─ No → REST + accept over-fetching for now
   │   └─ No (single client or similar data needs) → REST
   │
   └─ Does UI need to iterate frequently without app releases?
       ├─ Yes → SDUI pattern (over REST or GraphQL) — see server-driven-ui.md
       └─ No → continue with chosen protocol
```

Default is always REST. Deviate only when there's a concrete reason documented in dialogue.

---

## Common Pitfalls

### GraphQL Without Platform Investment

Team adopts GraphQL because it's trendy. Doesn't invest in codegen, doesn't set up DataLoader, doesn't establish schema ownership. Result: worse experience than REST would have been, plus higher operational cost.

**Mitigation:** don't adopt GraphQL unless you're committing to the tooling ecosystem. The value lives there.

### REST as Pseudo-RPC

`POST /getUserDetails`, `POST /updateUserEmail`, `POST /deleteUser`. This is RPC wearing a REST costume. Loses all REST benefits (caching, discoverability).

**Mitigation:** use HTTP verbs correctly. `GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id`. Resource-oriented, not verb-oriented.

### Over-Nested Responses

Endpoint returns entire object graph in one call to avoid round-trips. Response is 2MB. Client code can't express partial-load. Update one field → re-fetch 2MB.

**Mitigation:** favor smaller endpoints with client-side composition. Or adopt GraphQL where clients ask for what they need.

### No Idempotency Story

API has `POST /payments` with no deduplication. Client retries on timeout. Now there are two payments.

**Mitigation:** idempotency keys on all non-idempotent mutations. Covered in `backend.md`.

### Breaking Changes Without Versioning

Endpoint changes field type from string to object. Old clients break mysteriously in production.

**Mitigation:** additive changes only. If you must break, version the path and deprecate gracefully.

### Rate Limits Discovered in Production

No rate limits set. One buggy client loop brings down the service for everyone.

**Mitigation:** set rate limits from day one. Err on the permissive side; tighten if needed. Return `429 Too Many Requests` with `Retry-After` header.

---

## Required Behaviors — Templates for Skill Output

When skill synthesizes output for an API-heavy feature, these behavior templates apply:

| Behavior | Template |
|----------|----------|
| Protocol stability | `Public API endpoints maintain backward compatibility — new fields may be added, existing fields never removed or retyped without versioning (verified by API contract test suite)` |
| Rate limiting | `API enforces rate limits of [N] requests per [window] per client (verified by integration test hitting limit)` |
| Pagination | `Endpoints returning collections paginate results with opaque cursor tokens (verified by integration test walking paginated results)` |
| Error clarity | `Error responses include machine-readable error code and human-readable description (verified by error response schema test)` |
| Idempotency | `Non-idempotent mutations accept Idempotency-Key header and return cached response on duplicate (verified by retry test)` |
| Documentation | `Every public endpoint has working code example in documentation (verified by doc example tests in CI)` |
| Time-to-hello-world | `New developer can complete first successful API call within 15 minutes following getting-started guide (verified by developer experience test)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions for an API-heavy feature, these templates apply:

```
Primary protocol: REST over HTTP. Rationale: single client type (mobile only), straightforward CRUD resources, no need for GraphQL infrastructure complexity at MVP stage. Source: Slack "How We Design Our APIs" — consistency with industry standards.

Protocol evolution: REST now, GraphQL later. Rationale: MVP has single client and simple data model, introducing GraphQL would add Apollo infrastructure overhead without justifying benefit. Migration path: when second client platform launches, evaluate GraphQL based on divergent data needs. Source: Airbnb "10x Faster with GraphQL and Apollo" — value emerges with multiple clients and platform tooling investment.

Internal service communication: gRPC between [service A] and [service B]. Rationale: [N]k RPS between these services, protobuf contracts prevent JSON schema drift, HTTP/2 multiplexing reduces latency. Client-facing API remains REST.

API design process: spec-first with internal review before implementation. Rationale: breaking API changes cost more than review overhead; writing spec forces explicit decisions on naming, errors, pagination. Source: Slack API design process.

Pagination strategy: cursor-based with opaque tokens (see pagination.md). Rationale: collections can grow beyond initial expectations; Slack's channels.list case shows how "good enough for now" becomes unmaintainable. Source: Slack "How We Design Our APIs."

Error contract: standard envelope with { error: { code, message, details? } }. Rationale: consistency across endpoints, machine-readable codes for client logic, human-readable messages for developer debugging.

Versioning posture: additive changes only, path-based versioning (/v2/) only when truly breaking changes required. Rationale: breaking changes disrupt every client; additive evolution preserves backward compatibility indefinitely.
```

Skill substitutes specifics based on feature context and dialogue answers.

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers. Entry points:

- **User described single-client MVP (e.g., "mobile app", "web dashboard")** → REST default, skip GraphQL unless frequent iteration signaled
- **User described multi-platform product (web + iOS + Android)** → evaluate GraphQL, ask about platform engineering capacity
- **User described internal microservices** → gRPC candidate, confirm team protobuf familiarity
- **User described "UI that needs to update without app releases"** → SDUI pattern, cross-reference server-driven-ui.md
- **User described public API for external developers** → REST, emphasize design principles (one thing well, consistency, meaningful errors)
- **User described real-time streaming between services** → gRPC with streaming, or WebSocket if client-facing
- **Integration with third-party APIs** → reference target API's protocol; align where reasonable, adapt at your boundary

---

## Invariants

- REST is the default; deviation requires explicit justification documented in architectural decisions
- Pagination is non-negotiable for any collection endpoint
- Rate limiting is set from day one, not retrofitted after incidents
- Idempotency keys are required for retry-capable mutations
- Breaking changes are never made without versioning and deprecation plan
- Protocol choice is reviewed when a second client platform enters the system — that's the typical inflection point