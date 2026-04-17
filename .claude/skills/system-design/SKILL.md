---
name: system-design
description: Architectural analysis framework for features and products. Classifies the subject into categories (data-heavy, real-time, offline-critical, media-heavy, integration-heavy, low-bandwidth), loads relevant domain references (offline sync, pagination, real-time protocols, caching, API selection, server-driven UI, cross-platform, media upload, network optimization, data modeling), conducts targeted non-functional requirements dialogue, and produces structured architectural decisions grounded in real-world engineering case studies (Slack, Airbnb, Dropbox, Dan Lew sync series, Instagram, Netflix, Facebook Lite). Use whenever a feature or product needs architectural analysis — selecting between protocol/storage/sync trade-offs, deciding pagination or caching strategy, evaluating offline-first requirements, choosing real-time transport, planning for emerging markets or low bandwidth, reasoning about scale tiers and consistency requirements. Triggers on tasks involving architectural decisions, technical strategy, system design interviews, NFR formulation, technology trade-off analysis, or when the question "how should this be designed?" requires an answer grounded in real engineering outcomes rather than generic advice.
---

# System Design Methodology

Decision-tree framework for producing non-functional requirements and architectural decisions grounded in real-world engineering case studies.

This skill is pure expertise. It does not read or write project files, does not know about calling commands, and does not manage identifiers. It receives context describing a system or feature, and returns a structured architectural analysis. Callers apply the output to their own artifacts.

---

## How This Skill Works

**Input:** free-form context describing a feature, product, or system. Could be a draft spec, a PRD, a user description, or a design sketch.

**Output:** single canonical markdown block containing required behaviors, architectural decisions, and open questions.

**Core loop:** triage the context → load relevant references → conduct targeted NFR dialogue → synthesize decisions.

Every step below is general — nothing here depends on which command called the skill, what format the caller expects, or where the output will be stored.

---

## Step 1: Triage the Context

Classify the subject into one or more categories. Multi-category is the norm — a chat feature is simultaneously real-time, offline-critical, and media-heavy.

### Categories

| Category | Signals in context | References to load |
|----------|---------------------|---------------------|
| Simple CRUD | Single resource, basic forms, no collaboration, no real-time, no media | none beyond nfr-taxonomy |
| Data-heavy | Lists, search, filters, analytics, dashboards, feeds | pagination.md, caching.md |
| Real-time | Chat, live feed, presence, collaboration, notifications | realtime.md |
| Offline-critical | Must function without network, field workers, mobile-first, travel, unreliable connectivity | offline-sync.md, data-model.md, caching.md |
| Media-heavy | Photo/video upload, streaming, galleries, attachments | media-upload.md, caching.md, network-optimization.md |
| Integration-heavy | External APIs, webhooks, third-party auth, data sync from external systems | api-selection.md |
| Low-bandwidth / emerging markets | Target regions with poor connectivity, metered data, low-end devices | network-optimization.md, caching.md |
| Cross-platform strategy | Decision about native vs KMP vs React Native vs Flutter at product level | cross-platform.md |
| Frequent UI iteration | A/B testing requirements, server-updatable UI, experiment-heavy | server-driven-ui.md |

### Triage Procedure

Skim the input context for concrete signals. Signals are domain words and flow descriptions, not explicit user statements. If the input says "users chat with each other" — that's real-time, even if the user never said "real-time."

Match signals against the table. Multiple matches are expected and correct. A chat-with-photos feature triggers real-time + offline-critical + media-heavy simultaneously.

If no signal matches, treat as Simple CRUD. Do not invent complexity that isn't there.

Always load `references/nfr-taxonomy.md` — it is the foundation for dialogue and question formulation. Everything else loads only when its category matches.

Never load all references. References cost context and conflate unrelated advice.

---

## Step 2: Load References

After triage, read the matched reference files from `references/`. Each reference is a self-contained decision tree with trade-offs, case studies, and anti-patterns.

### Reference Index

| File | Covers |
|------|--------|
| `nfr-taxonomy.md` | NFR dimensions, question bank, defaults — foundation for dialogue |
| `api-selection.md` | REST / GraphQL / gRPC / SDUI protocol selection with Airbnb, Trello, Slack cases |
| `pagination.md` | Cursor / offset / page-number with Slack evolution case study |
| `offline-sync.md` | Sync strategies, conflict resolution, Dan Lew series, Atlassian Trello sync |
| `realtime.md` | WebSocket / SSE / long-polling / push — Instagram Direct Messages patterns |
| `caching.md` | L1/L2 hierarchy, HTTP caching, Instagram Android disk cache, prefetching |
| `server-driven-ui.md` | SDUI trade-offs — Airbnb, DoorDash, Instacart View Model API |
| `network-optimization.md` | Lite apps, compression, QUIC — Facebook Lite, Spotify Lite, MS Teams, Snap |
| `media-upload.md` | Resumable uploads, chunking — Dropbox camera uploads patterns |
| `cross-platform.md` | Native / KMP / React Native / Flutter — Dropbox contra, Cash App pro |
| `data-model.md` | Two-ID problem, soft deletes, schema design for sync |

References are designed to be read independently. Read only what triage requires. Do not pre-load in case they become useful — they will not.

---

## Step 3: Conduct NFR Dialogue

After loading references, ask targeted questions to resolve ambiguity. The references supply the question bank; the context determines which questions matter.

### Question Count by Complexity

- 2–3 questions for Simple CRUD features
- 4–6 questions for single-category complex features
- 5–7 questions for multi-category complex features
- Never exceed 8 questions without explicit user request

The goal is decision convergence, not exhaustive discovery. Users dropped into a 15-question NFR interrogation abandon the process.

### Question Format

Always multiple-choice with an explicit default. Users accept the default with "ok" or override.

```
Expected concurrent users for this feature?
  a) Under 100 (default — most MVPs)
  b) 100 to 10,000 (growth phase)
  c) 10,000 to 1,000,000 (scale phase)
  d) Over 1,000,000 (specialist design required)
```

Defaults are opinionated. If the default is "no offline support" for a simple dashboard, say so and explain why. Users can override without friction.

### Question Ordering

Ask in this sequence — each answer narrows downstream questions:

1. **Scale / volume** first — influences every downstream decision
2. **Offline / consistency** second — affects data model, sync strategy
3. **Performance / latency** third — affects protocol selection, caching
4. **Specific trade-offs** last — cursor vs offset, SSE vs WebSocket

Skip questions made irrelevant by earlier answers. If user picks "under 100 concurrent" at scale, drop questions about CDN strategy or distributed sync — both overkill at that scale.

### When References Conflict

References are case studies. Dropbox says "cross-platform code sharing has hidden costs." Cash App says "Kotlin Multiplatform works well for us." Both are true — in different contexts.

When references disagree, present the conflict honestly:

> "Dropbox moved away from shared code between iOS and Android, citing hidden coordination costs. Cash App uses Kotlin Multiplatform successfully. The trade-off depends on team structure and feature type. For this project..."

Then recommend based on the context at hand.

---

## Step 4: Synthesize Output

After dialogue, formulate the answer. The output is one canonical block regardless of who called the skill.

### Output Block Format

```markdown
### System Design Analysis

#### Required Behaviors
- [testable behavior statement with verification criteria]
- ...

#### Architectural Decisions
- [Topic]: [chosen option]. Rationale: [why this over alternatives, referencing trade-off]. Source: [optional reference to real-world case].
- ...

#### Open Questions
- [Actionable question user must answer before implementation]
- ...
```

Any section can be empty. Omit empty sections entirely rather than outputting "(none)".

### Formulating Required Behaviors

Required Behaviors are testable statements. The caller decides whether each becomes an FR, UX requirement, edge case, or technical constraint in their artifact. Do not label them with identifiers — that is the caller's responsibility.

Every behavior follows this shape: a concrete action, a quantitative criterion where applicable, and a verification method in parentheses.

| NFR Dimension | Behavior Template |
|---------------|-------------------|
| Latency target | `System responds within Nms at p95 under normal network conditions (verified by performance test with M concurrent requests)` |
| Offline read | `User views [content] without network connection (verified by airplane mode test)` |
| Offline write | `System persists user actions when offline and syncs on reconnection (verified by offline queue test)` |
| Consistency window | `[Entity] updates are visible to [audience] within N seconds (verified by integration test)` |
| Retention | `System retains [data] for [period] (verified by retention policy test)` |
| Error state | `System presents retry option on network failure` |
| Sync indication | `System displays sync status when pending operations exist` |

Avoid statements that cannot be tested — "system should be fast" is not a behavior. "System responds within 500ms at p95" is.

### Formulating Architectural Decisions

Every decision has four parts: topic, chosen option, rationale with trade-off, optional source.

```
Pagination: cursor-based with opaque tokens. Rationale: feed data is dynamic (items added frequently), offset pagination causes page drift when users scroll a changing list. Source: Slack engineering "Evolving API Pagination at Slack."
```

The rationale must reference the trade-off with the alternative that was rejected. "We use cursor pagination" is not a decision — it's an assertion. "We use cursor pagination because offset would cause page drift in a dynamic feed" is a decision.

Source reference is optional but strongly preferred when a reference supplied the rationale. This makes decisions reviewable — someone can read Slack's post and verify the argument.

### Formulating Open Questions

Open Questions are decision points the dialogue could not resolve. Emit only when genuinely needed — if a confident default exists, pick it rather than deferring.

Open Questions must be actionable. Bad:

> Should we think about caching?

Good:

> Should cached feed items expire after 1 hour, 24 hours, or only on explicit refresh? Trade-off: shorter TTL means more network requests; longer TTL means potentially stale content.

The question must name concrete options and the trade-off between them.

---

## Output Format — Canonical Example

For a feed feature with offline read requirements and real-time likes:

```markdown
### System Design Analysis

#### Required Behaviors
- System loads feed within 500ms at p95 under normal network conditions (verified by performance test with 100 concurrent requests).
- User views the last 50 feed items without network connection (verified by airplane mode test).
- User actions (likes, comments) persist when offline and sync on reconnection (verified by offline queue test).
- System displays sync status indicator when pending operations exist.
- System presents retry option on network failure.

#### Architectural Decisions
- Pagination: cursor-based with opaque tokens. Rationale: feed data is dynamic (items added frequently by other users), offset pagination would cause duplicate items or skipped items during scrolling. Source: Slack engineering "Evolving API Pagination at Slack."
- Sync strategy: delta sync with server-generated opaque sync_token. Rationale: timestamp-based markers suffer from client clock skew; opaque tokens allow backend to change versioning logic without breaking clients. Source: Dan Lew "Syncing Changes" series.
- Real-time transport: Server-Sent Events for live like updates, push notifications as fallback when app backgrounded. Rationale: server-to-client only (no client streaming), simpler infrastructure than WebSocket, fits through standard HTTP proxies.
- Cache sizing: L1 memory cache at approximately 20% of available RAM for decoded bitmaps, L2 disk cache at 250MB with LRU eviction. Rationale: dominant memory cost on mobile is decoded bitmaps, not encoded bytes.

#### Open Questions
- Should cached feed items expire after 1 hour, 24 hours, or only on explicit pull-to-refresh? Trade-off: shorter TTL means more network requests and fresher content; longer TTL improves offline reliability but content may feel stale.
- Cross-device sync required? If user likes a post on phone, should it appear liked on tablet within seconds? Affects conflict resolution complexity.
```

---

## Anti-Patterns

These behaviors violate the skill contract.

### Do not modify files
Never use Write, Edit, or filesystem tools. The skill only reads references. All artifact manipulation belongs to the caller.

### Do not invent identifiers
Output contains no FR-001, UX-042, ADR-003, or similar. Callers assign identifiers in their own formats.

### Do not know about callers
Do not branch behavior on "if called by command X, do Y." The skill has one behavior regardless of caller. Callers adapt the output to their needs.

### Do not pad with training knowledge
If a reference was not loaded, do not introduce related concepts from general knowledge. Stay within the evidence the loaded references provide. Users who ask for Dropbox-sync-quality insight expect Dropbox-sync-quality references, not generic sync wisdom.

### Do not ask what the context already answers
Read the context first. If the PRD says "mobile iOS app for hospital ward nurses," do not ask "is this mobile?" or "is this iOS?" or "what is the environment?" Triage from context, ask only what is genuinely ambiguous.

### Do not emit empty sections
If dialogue produces no Open Questions, omit the `#### Open Questions` heading entirely. Do not output `#### Open Questions\n(none)`.

### Do not load all references
Triage selects which references to load. Loading everything pollutes the analysis with irrelevant trade-offs. A simple CRUD dashboard does not need to hear about resumable upload chunking.

### Do not overreach scope
The skill analyzes the system the user described. It does not propose new features, critique product direction, or suggest pivots. "This feature would be better as a different feature" is out of scope.

### Do not collapse every feature into "it depends"
Every decision has a recommended default based on the input. Defer to "it depends" only when the context genuinely underdetermines the choice. Users asking for a decision want a decision.

---

## Invariants

- Output is valid markdown that a caller can parse
- Required Behaviors are testable — each has a verification method or explicit observable
- Architectural Decisions include trade-off rationale, not bare assertions
- Open Questions are actionable with concrete options
- References cited when a loaded reference supplied the reasoning
- Skill works identically regardless of which command invoked it