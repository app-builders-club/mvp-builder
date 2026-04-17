---
name: system-design
description: Decision-tree framework for architectural trade-offs during implementation planning. Classifies the subject into categories (data-heavy, real-time, offline-critical, media-heavy, integration-heavy, frequent UI iteration), loads the minimum relevant references, supplies a question bank with opinionated defaults for caller-driven dialogue, and returns structured decisions (Architectural Decisions, Required Behaviors). Use whenever architectural choices must be committed to a document — protocol selection, pagination or caching strategy, offline sync approach, real-time transport, media upload strategy. Produces decisions, not implementation rules. Implementation details belong in code-level rules files.
allowed-tools: Read
---

# System Design Decision Tree

Architecture-level decision framework invoked by the implementation planning command. Takes feature context, supplies the caller with a targeted question bank, then synthesizes structured trade-off decisions for the caller to insert into its artifact.

This skill is pure expertise. It does not read or write project files, does not drive user dialogue, does not assign identifiers. The caller owns the interactive loop; this skill owns the decision trees, question bank, and output contract.

Decisions produced here are architectural (choose pattern X over pattern Y because of trade-off Z). Implementation rules (timeouts, library choices, API shapes) live in code-level rules files and are out of scope.

---

## How It Works

**Input:** structured context object from the caller — functional scope (from spec), technical requirements (from PRD), and user flows (from ux). May be supplemented with answers elicited from the user.

**Output:** single markdown block — `### System Design Analysis` with `#### Required Behaviors` and `#### Architectural Decisions`. Caller integrates into its artifact.

**Pipeline:** triage → load minimum references → supply question bank → receive answers → synthesize decisions.

**Boundary:** the caller runs the interactive loop with the user. This skill does not prompt the user directly; it returns the question set and ordering, and the caller executes the dialogue.

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
| Frequent UI iteration | A/B testing, server-updatable UI, rapid paywall/onboarding iteration | `server-driven-ui` |

### Triage Procedure

Read the input for concrete signals. "Users chat with each other" = real-time, even if "real-time" is never said. Match signals against the table — multiple matches are expected.

Always load `references/nfr-taxonomy.md`. It is the question bank and decision foundation for every dialogue.

Never load all references. Triage selects. If no category matches, treat as Simple CRUD.

---

## Step 2: Load References

Read only the matched files from `references/`. Each reference is a decision tree with trade-off summaries and output templates. Do not pre-load references speculatively.

---

## Step 3: Elicit Context (Caller-Driven)

After references are loaded, the caller runs a targeted dialogue using the question bank supplied by this skill. `nfr-taxonomy` is the source of truth for questions; context and triage determine which matter.

### Skill Responsibility

- Supply the list of questions to ask based on triage result
- Specify ordering (scale first, then offline/consistency, then performance/latency, then specific trade-offs)
- Specify question format (multiple-choice with one recommended default per question)
- Flag red-flag combinations that require extra warning in the caller's presentation
- Signal when context already answers a dimension — that question is skipped

### Caller Responsibility

- Present each question to the user (multiple-choice with the recommended default marked)
- Accept the user's selection or custom override
- Ensure every required question is answered before invoking Step 4
- Do not auto-accept defaults — the user must explicitly acknowledge each decision, even if it is the recommendation

### Question Count

- 2–3 questions for Simple CRUD
- 4–6 questions for single-category features
- 5–7 questions for multi-category features
- Never exceed 8 without explicit user request

Goal is decision convergence, not exhaustive discovery.

### Question Format (Supplied to Caller)

```
Expected concurrent users for this feature?
  a) Under 100 (recommended — most MVPs)
  b) 100 to 10,000 (growth phase)
  c) 10,000 to 1,000,000 (scale phase)
  d) Over 1,000,000 (specialist design required)
```

The recommended option is derived from defaults in `nfr-taxonomy.md` and triage context. The caller presents all options; the user selects.

### Question Ordering

Each answer narrows downstream questions:

1. **Scale / volume** — influences every downstream decision
2. **Offline / consistency** — affects data model, sync
3. **Performance / latency** — affects protocol, caching
4. **Specific trade-offs** — cursor vs offset, SSE vs WebSocket

Skip questions made irrelevant by earlier answers. Context that explicitly answers a dimension (e.g., "iOS app for hospital nurses" = mobile + Developed consumer) does not need to be re-asked.

### Red Flags

Certain answer combinations require the caller to surface an explicit warning alongside the question (see `nfr-taxonomy.md` → Red Flags section). Examples: Offline: Full + Consistency: Strong, Security: Regulated, Scale: >1M. The caller must make the trade-off visible before accepting the user's choice.

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

### No Open Questions

Output never contains an Open Questions section. All ambiguity must be resolved through Step 3 dialogue before synthesis runs. If the caller reaches Step 4 with unresolved answers, it is a caller contract violation — the skill refuses to synthesize and signals which questions remain unanswered.

---

## Anti-Patterns

- **Do not modify files.** The skill only reads references. Artifact manipulation belongs to the caller.
- **Do not run the interactive loop internally.** Provide questions, ordering, and defaults; the caller drives the dialogue.
- **Do not invent identifiers.** No FR-001, NFR-042, ADR-003. Caller assigns them.
- **Do not branch on caller.** The skill has one behavior regardless of which command invoked it.
- **Do not pad with training knowledge.** If a reference was not loaded, its domain is out of scope for this run.
- **Do not ask what context already answers.** If the description says "iOS app", do not ask "is this iOS?"
- **Do not emit empty sections.** Omit the heading entirely rather than output `(none)`.
- **Do not emit Open Questions.** All architectural ambiguity must be resolved before synthesis. If it isn't, halt and signal the caller.
- **Do not load all references.** Triage selects. Loading everything pollutes analysis with irrelevant trade-offs.
- **Do not prescribe implementation.** No specific timeouts, library names, MB thresholds, or API shapes. That is the rules files' job. Skill names the pattern; rules specify the implementation.
- **Do not collapse every decision into "it depends".** Every trade-off has a default based on the context. Apply the default when the user acknowledges it; ask when context genuinely underdetermines the choice.

---

## Invariants

- Output is valid markdown parseable by the caller
- Output contains exactly two possible sections: Required Behaviors and Architectural Decisions. No Open Questions.
- Required Behaviors are testable (each has a verification method)
- Architectural Decisions name the rejected alternative in the rationale
- Every decision in the output traces to a user-confirmed answer or to a dimension that context explicitly resolved
- Skill works identically regardless of caller
- Implementation specifics never appear in skill output