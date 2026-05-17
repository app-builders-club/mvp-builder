# Multi-Approach Synthesis

When stakes are high or initial confidence is shaky, one reasoning mode isn't enough. The defense is to run two or three different modes on the same question *independently*, then synthesize what they produce.

The principle: convergence across independent modes is much stronger evidence than convergence within one mode. Three thoughts in abductive mode all pointing at the same cause is suspicious — that's how single-mode confabulation works (each thought reinforces the last). Three *different* modes pointing at the same cause is genuine multi-angle agreement.

This reference covers: when the skill triggers this automatically, how to run modes in parallel without contaminating them, how to handle convergence and divergence, and worked examples.

## Contents

1. [When this fires automatically](#when-this-fires-automatically)
2. [Why parallel runs beat sequential](#why-parallel-runs-beat-sequential)
3. [Choosing the modes to combine](#choosing-the-modes-to-combine)
4. [Running modes in parallel](#running-modes-in-parallel)
5. [Synthesis: convergence and divergence](#synthesis-convergence-and-divergence)
6. [Worked examples](#worked-examples)
7. [Cost discipline](#cost-discipline)

---

## When this fires automatically

The user doesn't have to ask. The skill triggers multi-approach synthesis on any of these conditions:

- The decision is **irreversible** (Type 1) AND initial confidence after first-pass reasoning is *not high* — somewhere short of "I'd defend this to a thoughtful skeptic." (As a rough gate: under ~80%. This is an activation heuristic, not a number to track inside the chain.)
- Two thoughts within the chain **contradict each other** and the contradiction isn't easily resolved.
- The first-pass conclusion **feels too clean** given the known complexity of the problem.
- An **adversarial check** (steelman, red team, pre-mortem) surfaced a substantive objection that current evidence can't dismiss.
- The user explicitly requested **high-assurance reasoning** or flagged that the decision matters.
- **Multiple stakeholders** with different framings would care about this answer.

When none of these fire, single-mode is the right tool — multi-approach is expensive (more thoughts, more tokens) and shouldn't be the default for every question. The skill is designed to spend the extra effort where it pays back, not as routine overhead.

Conversely, when one of these fires, *don't skip the synthesis to save effort.* The cost of being confidently wrong on a Type 1 decision is exactly what this technique exists to prevent.

---

## Why parallel runs beat sequential

Sequential reasoning has a structural weakness: each thought is conditioned on the previous one. If thought 1 framed the problem incorrectly, thoughts 2-5 inherit the framing. By thought 5, you have a coherent chain that confirms a wrong starting assumption — and the coherence feels like rigor.

Parallel reasoning attacks the problem from independent starting points. Mode A doesn't see Mode B's intermediate conclusions. They produce their answers separately, then are compared. Errors in one mode don't propagate to the others. When they agree anyway, that agreement is much harder to explain by a single shared mistake.

This is the same logic as ensemble methods in ML, multiple instruments in measurement, or two doctors independently reading the same scan. The strength comes from *independence*, not just from doing more work.

The threat to parallel reasoning is contamination: peeking at Mode A's results before running Mode B, or letting Mode A's framing leak into Mode B's setup. The discipline is to *fully commit each mode to its own framing* before comparing.

---

## Choosing the modes to combine

The modes should attack the problem from *different angles*, not the same angle with different vocabulary. Two modes that are essentially the same reasoning under different names give you no real independence.

Good pairings for different problem types:

**Debugging an outage or intermittent issue:**
- Abductive (best explanation from observations) +
- IS/IS-NOT analysis (where the problem is vs. where it isn't) +
- Counterfactual ("if we hadn't done X, would the symptom still appear?")

These three are genuinely independent. Abductive starts from observations and generates candidates. IS/IS-NOT starts from differential patterns and rules things out. Counterfactual starts from each candidate cause and tests whether removing it would remove the effect.

**Architecture or design decision:**
- First-principles (strip convention, derive from fundamentals) +
- Analogical (what does a similar successful / failed system teach us?) +
- Inversion (how would this design guarantee failure?)

First-principles produces a clean answer; analogical anchors it to reality; inversion stress-tests it.

**High-stakes prediction or estimate:**
- Inside view (bottom-up estimate of this specific case) +
- Reference-class / outside view (how have similar things actually gone?) +
- Pre-mortem (what's the failure mode that would invalidate the estimate?)

The inside / outside view tension catches planning-fallacy optimism. Pre-mortem catches blind spots in both.

**Evaluating an argument or proposal:**
- Direct critique (where's the weakest link?) +
- Steelman (what's the strongest version?) +
- Second-order ("if this is implemented, what happens next?")

Direct critique attacks; steelman defends; second-order asks whether the outcome is even what we want.

**Strategic decision under uncertainty:**
- Reversibility check (is this Type 1 or Type 2?) +
- Opportunity-cost view (what are we *not* doing?) +
- Pre-mortem (assume it fails; explain why)

These don't generate the answer — they constrain the kind of answer that makes sense.

### Why not run all 5+ modes?

Diminishing returns and rising contamination risk. Three modes can stay genuinely independent in your reasoning; six tend to bleed into each other and the effort isn't proportional to the marginal evidence. Two is sometimes enough; three is the typical sweet spot; four is occasional; five+ is rarely justified.

---

## Running modes in parallel

The mechanic:

1. **Specify the question precisely** — phrased neutrally, without favoring any framing.
2. **For each mode, start a fresh thought thread** in the MCP tool. Use the `branch_from_thought` / `branch_id` parameters to keep them tracked separately. Don't let them reference each other's intermediate results.
3. **Run each mode to a conclusion.** Each one ends with a clear answer to the question (or an explicit "this mode can't resolve it given current evidence").
4. **Only then bring them together.** Synthesis is a separate step.

```
Question: "What's the root cause of the intermittent /checkout timeouts?"

Mode A (abductive): branch_id="abductive"
  → Catalog observations.
  → Generate 4 candidate causes.
  → Score and pick best.
  → Conclusion: "DB connection pool exhaustion most likely."

Mode B (IS/IS-NOT): branch_id="isnot"  
  → Map IS / IS-NOT across four dimensions.
  → Compare candidates against both sides.
  → Conclusion: "Pool exhaustion explains both IS and IS-NOT."

Mode C (counterfactual): branch_id="counterfactual"
  → For each candidate, ask: if this were removed, would symptom remain?
  → Conclusion: "Pool size increase would resolve."

Synthesis (main thread):
  → All three converge on pool exhaustion.
  → High confidence; proceed with fix.
```

### Common mistakes

- Letting one mode's conclusion frame the others. *"Mode A says it's the pool. Let me apply Mode B to confirm."* This isn't independent verification — it's confirmation. Mode B should run without seeing Mode A's conclusion.
- Skipping a mode because "it'll obviously give the same answer." If you're confident it will agree, run it anyway; that's the point. If it disagrees, you've discovered something important.
- Picking modes that aren't actually independent. Two flavors of analogical reasoning aren't multi-approach; they're a single approach with cosmetic variation.

---

## Synthesis: convergence and divergence

### Convergence

All modes point at the same answer.

This is **high-confidence evidence**, but not certain truth. The remaining error scenarios:
- All modes share a common blind spot. (E.g., all three assume the user's framing is correct, but it isn't.)
- The evidence available to all modes is contaminated by a common source.
- A subtle confabulation appears identical in different reasoning frames.

When convergence happens, the appropriate move is *act with high confidence, while remaining open to disconfirming evidence.* Not certainty; high confidence.

In the output, convergence justifies stronger claims:
> "Three independent angles — abductive analysis of the symptoms, IS/IS-NOT differential, and counterfactual check — all identify connection pool exhaustion as the cause. Recommend increasing pool size; high confidence."

### Divergence

Modes disagree.

This is **the most important signal** the technique produces. It says: *don't trust any single mode's conclusion right now.* The obvious answer is probably wrong; the problem is more complex than any single frame captured.

Three responses, in order:

**1. Investigate the source of the disagreement.** Why does Mode A say X and Mode B say Y? Often the disagreement reveals an underlying ambiguity in the question itself, or a missing piece of evidence that would resolve which mode is right.

**2. Run a tiebreaker mode.** A fourth mode chosen specifically to discriminate between A and B. If A and B disagree about whether the cause is structural or behavioral, a counterfactual analysis ("if we'd had different process but same structure, would this still happen?") might settle it.

**3. Hold the conclusion as tentative.** If the disagreement can't be resolved with current evidence, the honest output is: "These two angles give different answers. Resolving requires [specific additional evidence]. Recommend gathering that before acting."

The temptation when modes disagree is to pick the one you preferred from the start. That's the opposite of what the technique is for. The disagreement *is* the finding; resolving it requires real work, not preference.

### Partial convergence

Sometimes two modes agree and one dissents. Treat the dissent as a signal, not a defeat. The dissenting mode is doing exactly the job it's supposed to do — surfacing an angle the others missed. Investigate the dissent before accepting the majority.

If the dissenting mode has a weaker grip on the problem (lower evidence base, weaker fit), the majority probably wins. If the dissenting mode is *most* fit for the problem type, its disagreement may be the most important data point.

---

## Worked examples

### Example 1: Architectural decision (convergence)

```
Question: "Should we extract the recommendations service from the monolith now,
           or wait?"

Mode A — First-principles:
  Strip assumptions. What's the actual benefit of extraction? Independent scaling,
  team autonomy, deploy independence. What's the actual cost? Operational
  complexity, distributed debugging, network failures becoming application-visible.
  At current team size (5), the benefits are small (no scaling pressure, single team
  owns it) and costs are concrete. Conclusion: wait.

Mode B — Analogical:
  Look at companies that extracted similar services at our scale. The pattern is
  premature extraction → operational debt → eventually folded back into monolith
  → re-extracted at larger scale. The successful pattern is extraction *when team
  size forces it*. Conclusion: wait, but document the extraction plan now.

Mode C — Pre-mortem:
  Assume we extract now and it fails. Failure modes: oncall burden distributes
  across services without enough engineers; observability tooling not ready;
  domain boundary turns out to be wrong after a year. All of these failures are
  visible *now* (small team, weak observability, domain still evolving).
  Conclusion: extraction now would hit the predictable failure modes; wait.

Synthesis: Three independent angles, three "wait" conclusions. High confidence:
           wait, but use the time to mature observability and clarify the
           domain boundary so extraction is faster when triggered.
```

The convergence is strong because the three modes are genuinely different. First-principles ignores history; analogical *uses* history; pre-mortem imagines the future. They agreed despite different starting points.

### Example 2: Debugging an intermittent (divergence → tiebreaker)

```
Question: "Why are 0.3% of users seeing logged-out states mid-session?"

Mode A — Abductive:
  Candidate causes:
  1. Session token expiring early due to clock skew.
  2. Race condition in token refresh.
  3. Token storage in a flaky cache layer.
  Highest-scoring: race condition in refresh logic (recent change).
  Conclusion: race condition in token refresh.

Mode B — IS/IS-NOT:
  IS: 0.3% of users, randomly distributed, all session lengths > 1 hour.
  IS-NOT: short sessions, specific user segments, specific browsers.
  Differential: only emerges after 1 hour. Refresh hypothesis fits (refresh
  happens around the 1-hour mark). But race condition would be browser-agnostic
  *and* could happen at any session length, not just > 1 hour.
  Conclusion: probably token expiration handling, not race condition.

Modes disagree. Both have evidence; both are plausible.

Tiebreaker: counterfactual.
  If it's a race condition in refresh, *what would change in the symptom* if
  we made refresh single-threaded? Race conditions would disappear; the 0.3%
  rate would drop to ~0.
  If it's token expiration handling, single-threading refresh wouldn't help.

Test: serialize refresh in a canary. Observe rate.
  Result: rate unchanged.

Final synthesis: Mode B was right. The race condition framing felt plausible
                 (recent change, intermittent rate) but didn't survive the
                 differential analysis. The differential was the decisive
                 clue — and it would have been missed without IS/IS-NOT.
```

The technique caught a wrong answer that abductive reasoning alone would have shipped.

---

## Cost discipline

Multi-approach synthesis costs roughly 2-3x the tokens of single-mode. That cost is paid back when it prevents one wrong high-stakes decision. It's *not* paid back if applied to every routine question.

The auto-triggers above are calibrated to fire on the right cases. If you find the technique firing on questions where single-mode would clearly suffice, the triggers are miscalibrated for the situation — drop down to single mode and note it.

Conversely, if you find single-mode being applied to a Type 1 decision and the conclusion is uncomfortable, that's the situation to *deliberately* invoke the technique, even without an automatic trigger. The judgment call is part of the harness; the auto-triggers are heuristics, not the whole rule.

The opportunity cost of a wrong Type 1 conclusion is much larger than the token cost of triangulating. When in doubt, triangulate.
