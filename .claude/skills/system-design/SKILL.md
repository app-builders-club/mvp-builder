---
name: system-design
description: Decision tree for architectural trade-offs during document generation (PRD, feature spec, technical plan). Classifies the subject into categories (data-heavy, real-time, offline-critical, media-heavy, integration-heavy, cross-platform, frequent UI iteration), loads the minimum relevant references, conducts a targeted NFR dialogue with opinionated defaults, and returns structured decisions (Required Behaviors, Architectural Decisions, Open Questions) that the caller command integrates into its artifact. Use whenever architectural choices must be committed to a document — protocol selection, pagination or caching strategy, offline sync approach, real-time transport, cross-platform platform choice. Produces decisions, not implementation rules. Implementation details belong in code-level rules files.
---

# System Design Decision Tree

Architecture-level decision tree invoked by doc-generation commands. Takes a feature or product description, returns structured trade-off decisions for the caller to insert into its artifact (PRD / feature / plan).

This skill is pure expertise. It does not read or write project files, does not know which command invoked it, and does not assign identifiers. Decisions it produces are architectural (choose pattern X over pattern Y because of trade-off Z). Implementation rules (timeouts, library choices, API shapes) live in code-level rules files and are out of scope here.

---

## How It Works

**Input:** free-form description of the feature or product. May be a draft spec, a section of a PRD, a user description.

**Output:** single markdown block — `### System Design Analysis` with `#### Required Behaviors`, `#### Architectural Decisions`, `#### Open Questions`. Caller integrates into its artifact.

**Loop:** triage → load minimum references → NFR dialogue → synthesize decisions.

---

## Step 1: Triage

Classify the subject. Multi-category is the norm — a chat-with-photos feature is real-time + offline-critical + media-heavy.

| Category | Signals | References to load |
|----------|---------|--------------------|
| Simple CRUD | Single resource, basic forms, no collaboration, no real-time, no media | none beyond `nfr-taxonomy` |
| Data-heavy | Lists, search, filters, dashboards, feeds | `pagination`, `caching` |
| Real-time | Chat, live feed, presence, collaboration, push | `realtime` |
| Offline-critical | Must work offline, field work, unreliable connectivity | `offline-and-data`, `caching` |
| Media-heavy | Photo/video upload, streaming, galleries | `media-upload`, `caching` |
| Integration-heavy | External APIs, webhooks, third-party sync | `api-selection` |
| Cross-platform strategy | Choice of native vs Flutter vs web at product level | `cross-platform` |
| Frequent UI iteration | A/B testing, server-updatable UI, rapid paywall/onboarding iteration | `server-driven-ui` |

### Triage Procedure

Read the input for concrete signals. "Users chat with each other" = real-time, even if "real-time" is never said. Match signals against the table — multiple matches are expected.

Always load `references/nfr-taxonomy.md`. It is the question bank and decision foundation for every dialogue.

Never load all references. Triage selects. If no category matches, treat as Simple CRUD.

---

## Step 2: Load References

Read only the matched files from `references/`. Each reference is a decision tree with trade-off summaries and output templates. Do not pre-load references speculatively.

---

## Step 3: NFR Dialogue

After references are loaded, ask targeted questions to resolve ambiguity. `nfr-taxonomy` supplies the question bank; context and triage determine which questions matter.

### Question Count

- 2–3 questions for Simple CRUD
- 4–6 questions for single-category features
- 5–7 questions for multi-category features
- Never exceed 8 without explicit user request

Goal is decision convergence, not exhaustive discovery.

### Question Format

Multiple-choice with explicit default. Users accept with "ok" or override.

```
Expected concurrent users for this feature?
  a) Under 100 (default — most MVPs)
  b) 100 to 10,000 (growth phase)
  c) 10,000 to 1,000,000 (scale phase)
  d) Over 1,000,000 (specialist design required)
```

### Question Ordering

Each answer narrows downstream questions:

1. **Scale / volume** — influences every downstream decision
2. **Offline / consistency** — affects data model, sync
3. **Performance / latency** — affects protocol, caching
4. **Specific trade-offs** — cursor vs offset, SSE vs WebSocket

Skip questions made irrelevant by earlier answers. Context that explicitly answers a dimension (e.g., "iOS app for hospital nurses" = mobile + Developed consumer) does not need to be re-asked.

---

## Step 4: Synthesize Output

Single canonical block regardless of caller:

```markdown
### System Design Analysis

#### Required Behaviors
- [testable behavior with verification criterion]
- ...

#### Architectural Decisions
- [Topic]: [chosen option]. Rationale: [trade-off vs rejected alternative].
- ...

#### Open Questions
- [Actionable question with concrete options and trade-off]
- ...
```

Any section can be empty. Omit empty sections entirely — do not emit `(none)` placeholders.

### Required Behaviors

Testable statements. Each has a concrete action, a quantitative criterion where applicable, and a verification method in parentheses. No identifiers — the caller command assigns those.

Avoid "system should be fast". Write "system responds within 500ms at p95 under normal network (verified by performance test with 100 concurrent requests)".

### Architectural Decisions

Four parts: topic, chosen option, rationale with trade-off against the rejected alternative, optional source.

Bad: "We use cursor pagination."
Good: "Pagination: cursor-based. Rationale: feed is active (items added during scroll), offset would cause duplicates or skipped items."

The rationale must name the alternative that was rejected and why.

### Open Questions

Emit only when dialogue could not resolve a decision and no confident default exists. Must be actionable: name concrete options and their trade-off. "Should we think about caching?" is not actionable. "TTL 1h vs 24h vs only-on-refresh: trade-off between freshness and offline reliability" is.

---

## Anti-Patterns

- **Do not modify files.** The skill only reads references. Artifact manipulation belongs to the caller.
- **Do not invent identifiers.** No FR-001, NFR-042, ADR-003. Caller assigns them.
- **Do not branch on caller.** The skill has one behavior regardless of which command invoked it.
- **Do not pad with training knowledge.** If a reference was not loaded, its domain is out of scope for this run.
- **Do not ask what context already answers.** If the description says "iOS app", do not ask "is this iOS?"
- **Do not emit empty sections.** Omit the heading entirely rather than output `(none)`.
- **Do not load all references.** Triage selects. Loading everything pollutes analysis with irrelevant trade-offs.
- **Do not prescribe implementation.** No specific timeouts, library names, MB thresholds, or API shapes. That is the rules files' job. Skill names the pattern; rules specify the implementation.
- **Do not collapse every decision into "it depends".** Every trade-off has a default based on the context. Defer only when the context genuinely underdetermines the choice.

---

## Invariants

- Output is valid markdown parseable by the caller
- Required Behaviors are testable (each has a verification method)
- Architectural Decisions name the rejected alternative in the rationale
- Open Questions are actionable (concrete options + trade-off)
- Skill works identically regardless of caller
- Implementation specifics never appear in skill output