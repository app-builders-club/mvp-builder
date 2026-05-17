# Reasoning Modes

Seven modes of inference, each suited to different problem shapes. Picking the right mode is half the work — applying the wrong mode to a problem produces fluent but wrong answers. This reference exists to make mode selection deliberate rather than habitual.

## Contents

1. [How to choose a mode](#how-to-choose-a-mode)
2. [Deductive](#deductive) — rules → consequences
3. [Inductive](#inductive) — observations → pattern
4. [Abductive](#abductive) — evidence → best explanation (the debugging mode)
5. [Analogical](#analogical) — transfer structure across domains
6. [Counterfactual](#counterfactual) — vary one factor, trace consequences
7. [First-principles](#first-principles) — strip convention, rebuild from fundamentals
8. [Inversion](#inversion) — work backward from failure
9. [Occam's Razor as hypothesis selector](#occams-razor-as-hypothesis-selector)
10. [Mixing modes within one chain](#mixing-modes-within-one-chain)

---

## How to choose a mode

The mode is determined by the *shape* of the question, not the topic. Same topic can require different modes depending on what's being asked.

Quick selector:

| If the question is... | Use mode |
|---|---|
| "Given these rules, what follows?" | Deductive |
| "What pattern fits these observations?" | Inductive |
| "What's the most likely cause / explanation?" | Abductive |
| "How is this similar to something I understand?" | Analogical |
| "What if X had been different?" | Counterfactual |
| "Why do we even do it this way?" | First-principles |
| "How could this go wrong?" | Inversion |

Triggers for switching modes mid-chain:
- The current mode has produced 2-3 thoughts without progress.
- A thought reveals the question is actually a different shape than initially classified.
- Evidence appears that the current mode can't make use of.

The most common selection error is reaching for deductive reasoning (it feels rigorous) when the actual question is abductive (evidence-to-explanation). Deduction can't generate hypotheses; it can only test them.

---

## Deductive

Move from general rules to specific consequences. The mode of "given premises P1, P2, …, conclude C." Truth-preserving: if premises are true and the inference is valid, the conclusion is necessarily true.

### When it fits

- The rules are known and reliable (specifications, type systems, mathematical laws, agreed-upon constraints).
- The question is "what must follow from these inputs?"
- Verification of a proposed solution against established requirements.
- Eliminating possibilities by showing they contradict known rules.

### Playbook

1. State the premises explicitly. *All premises*, including the ones that feel obvious.
2. State the rule being applied. ("If A then B." "All X have property Y.")
3. Apply the rule to derive the conclusion.
4. Check for hidden assumptions in the premises — these are the usual failure points.

### Failure mode

The premises are wrong but the chain is internally valid, producing a confident wrong answer. Deductive chains feel rigorous because they *are* rigorous; that rigor doesn't compensate for a false starting point. Before trusting a deductive conclusion, verify the premises.

### Example shape

```
Premise: This function never modifies its inputs (per spec).
Premise: The bug shows input mutation.
Conclusion: Either the spec is wrong, or this function isn't the one being called.
Action: Verify the call path before assuming the spec is correct.
```

---

## Inductive

Move from observed instances to a general pattern. "Cases 1-N all show property P; the pattern is probably P." Truth-likely but not truth-preserving — even a strong inductive pattern can break on the next instance.

### When it fits

- Generalizing from logs, metrics, or test results.
- Inferring user behavior from sample data.
- Building a model of how a system behaves from repeated observations.
- Extracting a rule from several worked examples.

### Playbook

1. Catalog the observations. *All* of them — including ones that don't fit the emerging pattern.
2. Note the sample size and how it was selected. Cherry-picked samples produce confident-feeling but biased induction.
3. Articulate the candidate pattern.
4. Test for counter-examples within the data.
5. Estimate how far the pattern is likely to generalize. (Time? Scale? Conditions?)

### Failure mode

Premature generalization from a small or biased sample. The classic: three customers asked for feature X, so "customers want feature X" — but those three were the loudest, not the most representative. Always state the sample, not just the pattern.

### Example shape

```
Observations: 12 of the last 15 timeouts occurred between 14:00-15:00 UTC.
Pattern: Timeouts cluster in a specific hour.
Counter-check: Are there timeouts outside that window? (Yes, 3 of them.)
Refinement: Strong correlation with the hour, not exclusive.
Generalization range: Likely tied to a recurring daily process. Not necessarily future-proof if scheduling changes.
```

---

## Abductive

Start from observation, work toward the most likely explanation. This is the mode for debugging, diagnosis, root-cause analysis, and most real-world reasoning where you start with effects and need to find causes.

### When it fits

- A bug is happening; find the cause.
- A metric moved; explain why.
- A user complained; understand what really went wrong.
- Multiple plausible explanations exist and need to be compared.

### Playbook

1. **Catalog observations.** What's directly observed? What's reported? What's suspiciously absent (the dog that didn't bark)? Mark each by reliability.

2. **Generate candidate explanations — multiple, not one.** At least three. The most common abductive failure is locking onto the first plausible cause. Include:
   - The obvious explanation.
   - The systemic / structural explanation (not just the proximate cause).
   - At least one unconventional candidate.
   - The null hypothesis (maybe nothing unusual is happening; noise, coincidence, normal variance).

3. **Score each candidate on four dimensions:**
   - *Coverage:* does it explain all observations, including the surprising ones and the absences?
   - *Parsimony:* how many additional assumptions does it require? (Occam's Razor — see below.)
   - *Consistency:* does it fit with what's known about how the system works?
   - *Falsifiability:* what observation would prove it wrong? If nothing could, it's not a useful candidate.

   *Scoring is qualitative.* High / medium / low, or named comparisons ("strongest on coverage; weakest on parsimony"). Don't invent numbers — fabricated precision in candidate ranking is its own failure mode, indistinguishable from genuine ranking until acted on.

4. **Pick the best — but stay loose.** The current best explanation is the working hypothesis, not a verdict.

5. **Design the crucial test.** What's the single most informative check to distinguish the top candidates? Run that.

### Failure mode

Locking onto the first plausible explanation and confirming it instead of testing it. "It's probably the cache" — and then every subsequent observation gets interpreted through the cache hypothesis, even when it doesn't really fit. Counter this by *requiring* at least three candidates before picking one. (See `anti-patterns.md` — "Premature convergence" and "Overfitting to the first hypothesis" — for the in-chain detection signals.)

### Example shape

```
Observations:
  - /checkout latency tripled at 14:00.
  - Only US-East region.
  - Only checkout, not other endpoints.
  - Error rate is normal (just slow, not failing).
  - Deploy at 13:55 touched payment SDK.

Candidates:
  1. SDK deploy introduced sync calls. (Timing fits; scope fits — only checkout uses payment SDK.)
  2. DB connection pool exhaustion. (Could explain US-East specificity.)
  3. Coincidence with deploy; actual cause is upstream traffic pattern.

Scoring:
  1. Coverage: high. Parsimony: high (one change). Consistency: high. Falsifiable: yes (rollback test).
  2. Coverage: medium (doesn't explain why error rate is normal). Parsimony: medium.
  3. Coverage: low (doesn't explain region specificity).

Crucial test: deploy rollback to canary. Predicts latency returns if #1; doesn't if #2 or #3.
```

---

## Analogical

Transfer the structure of a familiar situation onto an unfamiliar one. Powerful for understanding new domains quickly — and treacherous when surface similarity hides deep structural difference.

### When it fits

- A new problem feels like one you've seen before.
- Explaining an unfamiliar concept by mapping it to a familiar one.
- Borrowing a solution pattern from a different domain.
- Inferring properties of a new system from a similar known system.

### Playbook

1. **Identify source and target.** Source = the domain you understand. Target = the unfamiliar one.

2. **Map the structure, not the surface.** What in the source corresponds to what in the target? Map *relationships* between elements, not just element names.

3. **Test mapping strength element-by-element.** For each correspondence, ask: is this a structural match or surface coincidence?

4. **Find where the analogy breaks.** This is the most important step. *Every analogy breaks somewhere.* The question is: does it break in a place that matters for the current decision? If yes, the analogy is misleading you. If no, the analogy is useful within bounds.

5. **Apply with explicit caveats.** "This works like X, except for [breakage point], where we'd need a different approach."

### Failure mode

Surface similarity mistaken for structural similarity. "Microservices are like Unix processes" — true at one level, misleading at another. The analogy works for "small, composable, independent" and breaks for "communication cost, debugging cost, deployment coordination." If you don't name where the analogy breaks, you'll silently apply it past its useful range.

### Example shape

```
Source: TCP retransmission with exponential backoff.
Target: Client-side retry on transient API failures.

Mapping:
  Packet loss → request failure (strong match)
  Backoff timer → retry delay (strong match)
  Connection state → request idempotency (weak match — TCP doesn't have to worry about idempotency the way HTTP retries do)
  Sliding window → request batching (no real correspondence)

Where it breaks: TCP retries are at a lower layer with stateful connections; HTTP retries must handle non-idempotent operations explicitly.

Useful application: borrow backoff curve. Don't borrow "retry indefinitely."
```

---

## Counterfactual

Vary one factor in a known situation and trace what would have happened. Mode for root-cause attribution, separating skill from luck, evaluating "what if" decisions.

### When it fits

- Determining the true cause of an outcome (was X necessary, or would it have happened anyway?).
- Evaluating a past decision separately from its outcome (good process, bad luck vs. bad process, good luck).
- Stress-testing a plan ("if our key assumption fails, what then?").
- Distinguishing correlation from causation.

### Playbook

1. **Establish the actual sequence of events.** What did happen, in what order.

2. **Identify the pivot point.** The factor you're going to vary. Keep everything else constant.

3. **Vary that factor only — minimally.** Avoid "and also everything else would have been different." That's storytelling, not counterfactual reasoning.

4. **Trace the cascade.** Immediate consequence, then second-order, then third. Stop when speculation outpaces evidence.

5. **Compare to actual.** Does the counterfactual outcome differ significantly? If yes, the pivot was load-bearing. If no, the pivot wasn't the real cause — keep looking.

6. **Run up and down.** *Upward* counterfactual (could it have gone better?) and *downward* counterfactual (could it have gone worse?) — both protect against hindsight bias.

### Failure mode

Picking an implausible counterfactual ("if the laws of physics had been different…") or sneaking in too many changes ("if we'd just done everything right…"). Discipline the variation to one minimal, plausible change.

### Example shape

```
Actual: We added a cache. Latency dropped 60%.

Claim being tested: "The cache caused the latency drop."

Counterfactual: What if we hadn't added the cache, but everything else had been the same?
  Would latency still have dropped? Probably not — no other change is large enough.
  → Cache is a strong candidate cause.

Counterfactual: What if we'd just upgraded the DB at the same time (which we also did)?
  → Both interventions overlapped. We can't fully separate them without more data.
  → Attribution is uncertain. The "60% from cache" claim is overconfident.
```

---

## First-principles

Strip away convention, analogy, and inherited assumption. Rebuild from what's irreducibly true. Mode for problems where the standard approach is the problem.

### When it fits

- Conventional solutions all have the same weakness, and that weakness is the bottleneck.
- The phrase "that's how it's done" is doing more work than it should in the current reasoning.
- A 10x improvement is needed and incremental optimization can't get there.
- Designing something genuinely new, where best-practice is either absent or actively misleading.

### Playbook

1. **List all the assumptions in play.** Especially the ones that feel like facts.

2. **For each, classify:**
   - *Law of nature / mathematics / logic.* Cannot be violated. Real constraint.
   - *Hard external constraint.* Imposed by a system you don't control (legal, physical, organizational). Real but contextual.
   - *Convention.* "How it's usually done." Not a real constraint, just a default.
   - *Cargo-culted assumption.* Inherited without examination. Often outdated.

3. **Set aside everything in the last two categories.** Pretend they don't exist.

4. **Reason from the first two categories only.** What's the simplest thing that would solve the actual problem given only those real constraints?

5. **Compare to convention.** If your reconstructed solution matches convention, convention was actually optimal — that's useful to know. If it differs significantly, you've found leverage.

6. **Reintroduce conventions selectively** where they earn their cost. Not as defaults.

### Failure mode

False sense of fundamentals. Calling something "first principles" when it's actually just a different convention. The discipline is to keep asking "but why does *that* have to be true?" until you hit something you can't reduce further — usually physics, math, or a specific external constraint. (See `anti-patterns.md` — "Faux first-principles" — for detection signals when this happens mid-chain.)

### Example shape

```
Question: "Our deploys take 45 minutes. How do we make them faster?"

Assumptions in play:
  - We test everything before deploying. (Convention, not law.)
  - We deploy the whole monolith. (Convention.)
  - We run tests serially. (Convention.)
  - Network transfer of artifact is required. (Law — bytes have to move.)
  - Some test coverage is needed. (Hard constraint — undertested code is risky.)

First-principles reconstruction:
  - Real constraints: bytes move, coverage matters.
  - Everything else is a convention to question.
  - Simplest model: only ship what changed, test only what's affected, run in parallel.
  - Compare to convention: massive divergence → significant leverage available.
```

---

## Inversion

Work backward from failure. Instead of "how do we succeed?", ask "how would we guarantee failure?" then avoid those paths. Mode for risk identification and stress-testing.

### When it fits

- The path to success has many failure modes you might be missing.
- A plan is going forward and everyone agrees with it (red flag — see if it survives inversion).
- Security, reliability, and safety reviews.
- Code review at design time.

### Playbook

1. **State the goal precisely.** What does success look like, concretely?

2. **Invert.** "If I wanted to make this fail as badly as possible, what would I do?" Generate freely — quantity over quality at this stage.

3. **Sort the failure modes** by likelihood × severity. The high-likelihood, high-severity ones are the priority.

4. **For each priority failure mode, generate the corresponding guard.** Often the guard is "don't do the inverted thing" — which is easier to verify than "do the right thing."

5. **Check existing plan against the guards.** Where is the plan unprotected against a likely-severe failure mode? That's where to invest.

### Failure mode

Generating failure modes the team is already protected against, while missing the real ones. The fix: include "what would an attacker / adversary / careless engineer do?" — that often surfaces blind spots the team's own perspective can't see.

### Example shape

```
Goal: Ship reliable auth system.

Inversions (how to guarantee failure):
  - Store passwords in plain text.
  - No rate limiting → brute force succeeds.
  - Sessions never expire → stolen sessions valid forever.
  - No audit trail → can't investigate compromise.
  - Auth state in shared global variable → race conditions.
  - Different code paths for "logged in" vs "not logged in" → bypass-able.

Sorted by likelihood × severity:
  - Rate limiting absent (HIGH likelihood of attack, HIGH severity).
  - Session expiration weak (MEDIUM × HIGH).
  - Audit trail missing (MEDIUM × MEDIUM).
  - Plain-text passwords (LOW likelihood team would do this, but CATASTROPHIC).

Current plan check: rate limiting present? Audit trail present? If not — fix before shipping.
```

---

## Occam's Razor as hypothesis selector

Among candidate explanations that account for the evidence equally well, prefer the one requiring the fewest unsupported assumptions.

This is not "prefer the simplest" in a vague aesthetic sense. It's a specific operation:

1. For each candidate, list the assumptions it requires beyond established facts.
2. Count assumptions, weighted by how speculative each is. A guessed timing coincidence counts more than a single well-supported premise.
3. The candidate with the lowest count is the leading hypothesis — *not* because complex explanations can't be right, but because the simpler one is more likely a priori and easier to test.

When the simple hypothesis fails its tests, *that's* when you escalate to the complex one. Don't start there.

Misuse to avoid: invoking Occam's Razor to prefer a hypothesis that doesn't actually cover the evidence. Coverage comes first; parsimony breaks ties among hypotheses that all cover the data. A simple explanation that ignores half the observations isn't simple — it's incomplete.

Einstein's correction: "Everything should be made as simple as possible, but no simpler." Domain-irreducible complexity is real. Distributed consensus has irreducible complexity. Concurrency has irreducible complexity. Don't oversimplify those into wrongness.

### Example shape

```
Three candidates for "/checkout 500s under load":

1. Network flakiness between app and DB.
   Assumptions: network is flaky AND only during peak AND only US-East AND only checkout. (Four conjoint assumptions.)

2. DB connection pool exhaustion during peak in US-East.
   Assumptions: pool is undersized for peak load in US-East. (One assumption; testable directly.)

3. Cosmic ray bit-flip.
   Assumptions: hardware failure AND no ECC AND specific timing. (Three assumptions, each individually unlikely.)

Lead with #2. Test by checking pool metrics. If pool was healthy, #2 is wrong — escalate to investigating #1.
```

---

## Mixing modes within one chain

Real reasoning chains rarely stay in one mode. A typical debugging chain might:

1. Start *abductively* (observations → candidate explanations).
2. Apply *deduction* to derive what each candidate predicts.
3. Use *counterfactual* to estimate "if cause X, would symptom Y still appear?"
4. Apply *Occam's Razor* to rank candidates.
5. Run an *inversion* check ("would this fix actually break something else?").

Mixing is good. The discipline is to be *aware* of which mode each thought is in, and to verify that mode-appropriate (the deductive step is actually deductive, not abductive disguised as deduction).

*Guard at every mode transition:* when you switch modes, re-examine the knowledge classes of the state you're carrying forward. The risk is that *verified* and *speculative* claims look identical once they're "established context" — and the new mode may lean on a claim the previous mode produced speculatively. Specifically: deductive reasoning can produce confident-looking conclusions from *believed-but-unverified* premises, and those conclusions then look verified to the next mode. Before switching, ask: *are the load-bearing claims I'm carrying still grounded, or did one of them drift?* (See `references/grounding.md` for the three knowledge classes.)

Common mixing errors:
- Calling abductive reasoning "deductive" because it has formal-looking structure. Abductive conclusions are best guesses; deductive conclusions are necessary truths given premises. Conflating them inflates apparent certainty.
- Doing a "first-principles" pass that's actually analogical (you imported the structure from somewhere familiar without noticing).
- Generating "counterfactuals" that vary three things at once. That's storytelling.

When in doubt, name the mode for each thought. The MCP tool's persistence makes this cheap — write the mode into the thought.
