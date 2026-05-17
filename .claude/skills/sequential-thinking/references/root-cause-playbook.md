# Root Cause Playbook

Debugging and incident analysis are abductive reasoning under pressure. The general abductive playbook (in `reasoning-modes.md`) covers the structure. This reference adds the specific tools that matter most for finding *real* causes — and the failure modes those tools fall into when applied carelessly.

Two main techniques:

1. **Five Whys Plus** — iterative drilling for causal depth, with explicit guards against stopping at the wrong place.
2. **IS/IS-NOT specification** — precise problem characterization by contrast, separating where the problem is from where it isn't.

The "Plus" in "Five Whys Plus" matters. Plain Five Whys has been used since Toyota in the 1950s and gets misapplied constantly. The plus is the guards that prevent the common misuses.

## Contents

1. [When to use this playbook](#when-to-use-this-playbook)
2. [Five Whys Plus](#five-whys-plus)
3. [IS/IS-NOT specification](#isisnot-specification)
4. [Combining both techniques](#combining-both-techniques)
5. [The four most common failure modes](#the-four-most-common-failure-modes)

---

## When to use this playbook

- Debugging non-trivial issues (intermittent, multi-component, unclear origin).
- Incident post-mortems where "find the root cause" is part of the deliverable.
- Recurring problems that previous fixes didn't actually solve.
- Process failures and "why does this keep happening" questions.

Don't use for: obvious bugs where the cause is in the stack trace. Use when there's a real investigation to do.

---

## Five Whys Plus

The standard technique: ask "why" repeatedly to drill from symptom to cause. Five iterations is a rule of thumb, not a target. The real stopping condition is *actionable depth* — not a count.

### The five iterations are a rough guide

The "five" is a heuristic to push past the proximate cause to something more fundamental. Some problems resolve at three whys; some need eight. Counting isn't the discipline; *not stopping too early* is.

### Standard structure

```
Symptom: [what's observable]
Why? → [first explanation]
Why? → [deeper explanation]
Why? → [further]
Why? → [further still]
Why? → [usually here you hit a system-level cause]
```

Each "why" needs to be specifically motivated by the answer to the previous one — not a generic deepening, but actually addressing *that* answer.

### The Plus — guards against the four common failures

The standard technique has four well-known failure modes. The Plus version puts explicit guards against each.

#### Plus 1: Evidence requirement

Each answer must be supported by something observed, not just plausible. When the answer is "probably X" without anything to back it up, that's the moment to mark it as a working hypothesis and *test* before drilling further. Drilling on top of unverified premises produces a five-deep chain of speculation that feels rigorous.

```
Why did the API time out?
  → "Probably the database was slow."
  ↑ Hypothesis, not yet evidence. Don't drill further on this until verified.

Verify first:
  - Check DB query latency metrics during the outage window.
  - If confirmed: drill into why the DB was slow.
  - If not confirmed: this branch was wrong — regenerate the why-1 candidates.
```

#### Plus 2: Branching for "what else?"

At any why-step, ask: *what else could have caused this?* If there are multiple plausible answers, name them. Pick the most likely as the main branch — but record the alternatives.

```
Why was the database slow?
  Main: Index missing on the new query path.
  Also possible: Lock contention from a concurrent batch job.
  Also possible: Plan regression from auto-statistics.

Drill on the main branch; come back if it doesn't pan out.
```

The single-cause assumption is the most common debugging error. Problems often have multiple contributing causes, and "the cause" is a simplification that hides the truth. Naming the alternatives keeps the door open.

#### Plus 3: Human-error doesn't terminate

Stopping at "an engineer made a mistake" is not a root cause — it's a stopping point dressed as one. The next why is *why was the mistake possible / undetected / repeatable?* That's where the system-level cause lives.

```
Why did the deploy break production?
  → Engineer pushed a config change without testing it.
  → "Engineer should have tested" — STOP if you accept this. But:
Why was untested config able to reach production?
  → CI pipeline doesn't enforce config validation.
Why doesn't the pipeline validate config?
  → Config validation has been a known gap for 6 months; never prioritized.
Why is it deprioritized?
  → No incident has been bad enough to justify the work — until now.
```

Now the action items are systemic (add validation, prioritize against future risk) rather than personal ("be more careful"). Personal action items don't generalize; systemic ones do.

The exception: when the right answer genuinely is "this person needs more training / different role / different process around them." Even then, the *system* question is "why was this allowed to develop into a problem?" — not "this person is the cause."

#### Plus 4: Stopping criteria — all of these, not any of them

Stop drilling only when *all four* are true:

- **Actionable.** Some concrete change addresses this level. ("Lack of monitoring" is actionable — add monitoring. "Lack of attention to detail" is not.)
- **Controllable.** It's something your team / org / system can change. (External vendor behavior is rarely controllable, but your *response* to it is.)
- **Generalizable.** Fixing this level would prevent similar problems, not just this exact one.
- **Evidenced.** This level is supported by what you've seen — not speculation that *would* explain it.

If a why-step fails any of these, you haven't reached root cause. Keep going (if there's more evidence to drill into) or branch (if the current path doesn't satisfy and a different angle might).

### Worked example: the full Five Whys Plus

```
Symptom: Production API returned 500s for 12 minutes on Tuesday.

Why 1: Why did the API return 500s?
  Main: Database connection pool exhausted; new requests couldn't get a connection.
  Evidence: Pool metrics show 100/100 in use at the incident window. Logs show
            "connection wait timeout" errors matching the spike.
  Also possible: Application bug causing requests to hang (ruled out — no recent deploys).

Why 2: Why was the connection pool exhausted?
  Main: Queries that normally take 50ms started taking 500ms+, holding connections longer.
  Evidence: Query latency metrics show 10x spike at incident time.
  Also possible: Connection leak (ruled out — total connections stable; just held longer).

Why 3: Why were queries 10x slower?
  Main: Missing index on payment_status table; sequential scan on 10M rows.
  Evidence: EXPLAIN shows seq scan; index does not exist.
  Also possible: Lock contention (ruled out — no blocking locks).

Why 4: Why was the index missing?
  Main: Index-creation migration was rolled back two weeks ago due to deploy timeout.
  Evidence: Deploy logs show rollback on the date in question; migration script exists.

Why 5: Why did the migration timeout?
  Main: 10M-row table; online index creation takes longer than the deploy window allows.
  Evidence: Estimated migration time ~2 hours; deploy window is 30 minutes.

Why 6 (system level): Why hadn't this surfaced before the outage?
  Main: No alerting on query performance degradation; first signal is connection
        pool exhaustion (i.e., we only learn there's a problem when it's already
        production-impacting).
  Evidence: No relevant alerts fired in the 2 weeks between missing-index and outage.

Stopping check at why-6:
  - Actionable: yes — add query latency alerting; build offline-migration tooling.
  - Controllable: yes — both within our team's scope.
  - Generalizable: yes — fixes apply to future similar cases.
  - Evidenced: yes — supported by the timeline.

Two root causes (multi-cause):
  1. No infrastructure for migrations that exceed deploy windows.
  2. No alerting on query-level performance degradation.

Action items:
  - Build / adopt online migration tooling that survives across deploy windows.
  - Add p99 query latency alerts.
  - Re-add the missing index using whatever works given current constraints.
```

The chain is six whys, with branching considered and ruled out at each step, with evidence at each step, and a stopping check confirming it's at root cause level.

---

## IS/IS-NOT specification

A problem is defined by where it occurs *and* where it doesn't. Specifying both sides precisely is one of the most powerful debugging tools — and one of the least applied, because it requires patience before generating hypotheses.

### The matrix

Four dimensions, two sides each:

|  | IS | IS NOT | What this distinction tells us |
|---|---|---|---|
| **What** (object) | What thing has the problem? | What similar things don't? | |
| **What** (defect) | What's specifically wrong? | What kinds of wrong aren't happening? | |
| **Where** (location) | Where is the problem occurring? | Where could it be occurring but isn't? | |
| **When** (timing) | When was it first observed? When does it recur? | When did it not happen? | |
| **Extent** (scope) | How many / how much is affected? | What scope is not affected? | |

Filling this in *before* generating hypotheses prevents the common error: "I have a theory" → confirmation bias → missing the obvious clue in the dimension you didn't look at.

### Why this works

Each IS / IS-NOT pair carries information. The fact that the problem occurs in US-East but not EU is just as informative as the fact that it occurs at all. The fact that it affects checkout but not other endpoints is informative. The dimensions where IS-NOT exists tell you something specific about the cause.

A real cause must explain *both sides.* If your hypothesis explains why the problem happens but doesn't explain why it doesn't happen elsewhere, the hypothesis is incomplete — and probably wrong.

### Worked example

```
Problem: API response time increased 4x on /checkout endpoint starting Monday 9 AM.

IS / IS NOT:

What (object):
  IS: /checkout endpoint
  IS NOT: /cart, /product, /user endpoints (which use the same DB, app servers)
  Distinction: Only payment-related endpoints affected.

What (defect):
  IS: 4x latency increase
  IS NOT: Errors, timeouts, data corruption
  Distinction: Performance only; correctness is fine.

Where (location):
  IS: Production US-East
  IS NOT: Production EU, Production US-West, staging
  Distinction: Single region, production only.

Where (on the object):
  IS: Database query phase of the request
  IS NOT: Auth, validation, response serialization
  Distinction: Bottleneck is in the DB-fetch stage.

When (timing):
  IS: Started Monday 9:00 AM, ongoing
  IS NOT: Before Monday, doesn't fluctuate by time of day after Monday
  Distinction: Distinct change at a specific moment; not load-correlated.

Extent:
  IS: ~30% of checkout requests
  IS NOT: 100% of requests
  Distinction: Intermittent within affected scope.

Changes near Monday 9 AM that might be related:
  - Payment provider SDK updated (Sunday night).
  - Fraud detection rules enabled (Monday 8:45 AM).
  - Database index rebuild scheduled (Sunday maintenance).

Possible causes, scored against IS / IS-NOT:

1. Fraud detection rules cause extra DB queries.
   Explains IS-checkout: ✓ (rules only on payment).
   Explains IS-NOT-EU: ✗ (rules deployed everywhere).
   Verdict: rules out unless rules deploy differs by region. Check.

2. Payment SDK update added sync HTTP calls.
   Explains IS-checkout: ✓ (SDK only used here).
   Explains IS-NOT-EU: ✗ (SDK shipped everywhere).
   Verdict: rules out unless SDK behavior depends on region.

3. Index rebuild affected checkout-specific query plans, region-specific replica.
   Explains IS-checkout: ✓ (specific query path).
   Explains IS-NOT-EU: ✓ (rebuild happened on US-East replica).
   Verdict: candidate. Verify by checking query plans on US-East vs EU.

Cause #3 is the only one that explains both sides. Test it first.
```

The IS/IS-NOT discipline killed two confident hypotheses (SDK update, fraud rules) that would have absorbed real debugging time. Hypothesis #3 was the only one to survive — and it would have been easy to miss without the region contrast forcing attention.

### What a partial specification misses

If you fill in only the IS side:

```
What: /checkout, 4x latency
Where: Production
When: Monday 9 AM
```

You can generate hypotheses, but you can't distinguish between them. The SDK hypothesis fits the IS side perfectly. So does the fraud-rules hypothesis. The IS-NOT side is where they fail — and where you find the real cause.

The technique pays its biggest dividend on debugging *multi-component or distributed problems*, where the differential pattern (here vs. there, this endpoint vs. that one, this time vs. that time) is often the decisive clue.

---

## Combining both techniques

IS/IS-NOT and Five Whys Plus work together. The typical order:

1. **Specify the problem** (IS/IS-NOT). Without this, you don't know what you're explaining.
2. **Generate candidate causes** (abductive, from the reasoning-modes reference). Use the IS/IS-NOT to score them — the cause has to explain both sides.
3. **Pick the leading candidate** (Occam's Razor among those that cover both sides).
4. **Five Whys Plus** to drill from the immediate cause to the systemic cause.
5. **Verify the chain** with evidence at each level.
6. **Identify the actionable layer.** It's usually higher than the proximate cause — often two or three "why" levels up.

The order matters. People who start with Five Whys without IS/IS-NOT often spec the problem fuzzily ("the API is slow") and drill into the wrong branch. IS/IS-NOT forces enough precision that the drilling stays on the right track.

---

## The four most common failure modes

To recap and reinforce — these are the patterns that turn a powerful technique into a confident-wrong answer:

### Failure 1: The blame stop

"An engineer made a mistake." Stop. *Why was the mistake possible?* The system that lets mistakes reach production is the cause, not the person. Personal action items don't generalize; systemic ones do.

### Failure 2: The premature technical stop

"It was a bug in the cache invalidation logic." OK — *why was that bug there? Why didn't anything catch it? Why wasn't this class of bug prevented by design?* Stopping at the technical proximate cause finds *a* fix but doesn't prevent the next similar bug.

### Failure 3: The circular why

A why-chain loops back on itself: "Why A? → Because B." → "Why B? → Because A." This is the signal that you're missing a third factor that causes both. The chain can't progress without external evidence to break the loop.

### Failure 4: The speculation dive

Each successive why is less grounded than the previous. By why-5 you're inventing causes that *would* explain the chain but aren't actually supported by anything. The fix is the evidence requirement (Plus 1) — every level needs something observed to back it up. When evidence runs out, mark that level as a hypothesis and *test* before drilling further.

The discipline isn't subtle. It's just persistent application of "do I have evidence for this, or did I generate it because the chain needed it?" — every time, every level.
