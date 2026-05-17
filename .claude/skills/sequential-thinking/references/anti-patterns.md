# Anti-Patterns

Specific failure modes in sequential reasoning, each with detection signals (how to notice it happening) and fixes (what to do once noticed). Most of these are subtle — they feel like progress while they're happening. The detection signals matter more than the labels.

Read this once before starting to use the skill seriously, and re-read when reasoning feels stuck or produced a wrong answer. Recognizing the pattern is most of the work; the fix is usually mechanical once the pattern is named.

## Contents

1. [Cycling](#cycling)
2. [Premature convergence](#premature-convergence)
3. [Fake confidence to avoid revision](#fake-confidence-to-avoid-revision)
4. [Overfitting to the first hypothesis](#overfitting-to-the-first-hypothesis)
5. [Sunk thoughts](#sunk-thoughts)
6. [Confirmation drift](#confirmation-drift)
7. [Speculation drift](#speculation-drift)
8. [Faux first-principles](#faux-first-principles)
9. [Optimizing the wrong thing](#optimizing-the-wrong-thing)
10. [Over-thinking trivia](#over-thinking-trivia)

---

## Cycling

Reasoning revisits the same ground repeatedly without progress. Thought 7 says essentially what thought 3 said, in different words.

### Detection signals

- A thought you're about to write sounds familiar — because you basically already wrote it.
- The chain is producing more thoughts but not narrowing the answer space.
- Confidence isn't shifting meaningfully across recent thoughts.
- You catch yourself saying "as established earlier..." about something you're now re-establishing.

### Why it happens

The current mode isn't equipped to make further progress on the question, but you keep trying. Repetition feels safer than admitting the mode has hit its limit.

### Fix

Switch modes. If you've been abductive and stuck, try counterfactual. If first-principles isn't yielding, try analogical. The next mode may produce in two thoughts what the current one couldn't produce in five.

If multiple modes have been tried and all are cycling, the problem is probably that you're missing information. Stop reasoning, gather data, then resume.

---

## Premature convergence

Stopping at the first answer that seems to work, before testing it against the strongest alternatives.

### Detection signals

- The first plausible explanation became the working hypothesis without comparison.
- You spent the chain refining one answer instead of comparing multiple.
- The chain has zero branches — every thought reinforced the previous one.
- Confidence rose quickly and stayed high.
- Your subjective sense is "I figured it out fast." For non-trivial problems, that's a signal to check.

### Why it happens

The first hypothesis fills a cognitive vacuum. Once a candidate is in mind, the mind preferentially looks for evidence that fits — and finds it.

### Fix

Force generation of at least one strong alternative before committing. Run a steelman: what's the most thoughtful case *against* the current answer? If the steelman has real teeth, branch and explore.

For high-stakes conclusions, run multi-approach synthesis. If a single-mode-quickly-reached answer survives independent verification, great. If not, you found a better answer.

---

## Fake confidence to avoid revision

Refusing to mark a prior thought as wrong because it would mean unwinding part of the chain. Pushing forward as if the questionable thought were solid.

### Detection signals

- An earlier thought now looks shaky given current evidence, but you're avoiding addressing it.
- You're rationalizing the earlier thought rather than examining it.
- A new thought is doing work to make the old one still seem right.
- You're computing how much would need to be redone if you revised — and that computation is influencing whether to revise.

### Why it happens

Backtracking feels like loss. The chain has momentum; revision interrupts it. Cognitively easier to push forward than to admit a wrong step and replan.

### Fix

This is exactly why the MCP tool has a `is_revision` flag. Use it. Revising is healthy; corrupting a long chain to preserve apparent progress is not.

The check: ask yourself, "if I'd reached this exact thought without the prior chain — starting fresh — would I still hold the earlier conclusion?" If no, revise. The sunk cost of prior thinking is not a reason to preserve a wrong conclusion.

---

## Overfitting to the first hypothesis

Once a hypothesis is in play, subsequent thoughts get filtered through it. Evidence that fits the hypothesis is noticed and counted; evidence that doesn't gets explained away or ignored.

### Detection signals

- Multiple pieces of evidence have been interpreted to fit a single hypothesis.
- You're spending effort on *how* the hypothesis explains a piece of evidence rather than *whether* it does.
- The hypothesis has become flexible — each new observation gets accommodated rather than testing the hypothesis.
- Counter-evidence is being characterized as "interesting" or "an edge case" rather than as disconfirming.

### Why it happens

Classic confirmation bias. A hypothesis is comfortable; alternatives are uncomfortable; the path of least resistance is to keep the comfortable one and shape evidence to it.

### Fix

For each piece of evidence the chain has touched, briefly consider: would this evidence look the same under hypothesis B? If yes, the evidence isn't actually discriminating between A and B — it's compatible with both. Don't count it as support for A.

Better: when a hypothesis seems to keep "winning," set it aside and try to reach the same conclusion from a different starting hypothesis. If the other hypothesis also explains the evidence, the evidence isn't selecting between them and the apparent strength of the current hypothesis is illusory.

---

## Sunk thoughts

Continuing along a reasoning path because of how much effort has gone into it, not because it's currently the best path.

### Detection signals

- "We've already established X..." about something that's looking questionable.
- Reluctance to consider an alternative angle that would moot earlier work.
- A new piece of evidence suggests the current path is wrong, but you're trying to make it fit anyway.
- The phrase "given everything we've already done" doing too much work.

### Why it happens

Direct cognitive sunk-cost fallacy. The chain has built up; abandoning it feels like throwing away the work.

### Fix

Sunk thoughts are irrelevant to future thoughts. The only question is: *given what we know now, what's the best next move?* If that move ignores or contradicts the prior chain, fine. The chain's purpose was to get you to this knowledge state; what you do with the knowledge is independent.

The discipline is identical to sunk cost in projects: ask "if I were starting from scratch with current information, would I be on this path?" If no, leave the path.

---

## Confirmation drift

Subtly different from overfitting. Here, the chain *generates* evidence that supports the current direction, rather than gathering it from outside. New thoughts invent supporting premises rather than finding them.

### Detection signals

- A thought introduces a premise that wasn't established earlier and isn't verified now, but makes the current hypothesis work.
- "This would explain why..." followed by something that wasn't on the original evidence list.
- The chain is growing more confident as it goes, even though no new external information has come in.
- Made-up specifics — numbers, dates, "I recall that..." statements that aren't anchored.

### Why it happens

When the chain stays internal (no external tool calls or evidence gathering), the only way to add information is to generate it. Generated information that supports the current direction feels like confirmation, but it's just self-reinforcement.

### Fix

When confidence rises within an internal chain — without new external evidence — be suspicious. *Real* confidence increase requires real new information from outside. If confidence is rising and you haven't read anything, checked anything, or run anything, the rise is probably internal confabulation.

Force an external check before letting confidence increase. ReAct (alternate reasoning with observation) is the structural defense.

---

## Speculation drift

Each successive thought is less grounded than the previous one. Started with verified observations, drifted into believed-but-unverified, ended in pure invention — but the chain reads as smooth.

### Detection signals

- The current thought's premises can't be traced back to verified ground.
- A specific number, date, version, or fact appeared in the chain without a source.
- You're answering questions ("how does feature X interact with system Y?") that you wouldn't have been able to answer at the start of the chain — but you haven't gathered any new data.
- The chain has gotten more specific over time, but no tool was called.

### Why it happens

Each thought leans on the previous one. If thought 3 is 80% grounded and you generate thought 4 leaning on it, thought 4 is at best 80% grounded — and probably less, because new specifics are filling in. By thought 7, you're deep in inference territory but it doesn't feel that way.

### Fix

Tag knowledge classes (verified / believed / speculative) as the chain progresses. Watch for the drift toward speculation. When a chain has been going for multiple thoughts without external grounding, *pause and verify a load-bearing premise* before continuing.

For high-stakes outputs, the chain's conclusion can't sit on speculative claims. Either verify those claims, or explicitly flag the conclusion as conditional on them.

---

## Faux first-principles

Calling something "first-principles" reasoning when it's actually just a different convention or an unexamined intuition dressed up as fundamentals.

### Detection signals

- The "first principles" derivation suspiciously echoes a method you've used before.
- Steps in the derivation skip over assumptions that should be questioned.
- The conclusion is what you'd have guessed anyway.
- "Fundamentally, the issue is..." followed by a statement that isn't actually fundamental.

### Why it happens

True first-principles is hard. It requires identifying real (physics, math, hard constraint) vs. apparent (convention, default, inherited assumption) constraints. The fake version skips the hard part and just relabels familiar reasoning.

### Fix

For each premise in the supposed first-principles derivation, ask: "*Why does this have to be true?*" If the answer is "because that's how it's done" or "because everyone agrees," it's not first-principles — it's convention. Drill down until you hit something irreducible: physics, math, a specific external constraint.

If the derivation doesn't survive that drilling, it wasn't first-principles. Call it what it actually is (analogical, conventional, intuitive) and use it with appropriate humility.

---

## Optimizing the wrong thing

The chain works hard on a question that's adjacent to, but not actually, the question the user asked. Or: the chain optimizes a metric that doesn't measure what matters.

### Detection signals

- Re-reading the original question after several thoughts feels like a slight surprise.
- The chain is focused on a sub-question that's interesting but tangential.
- A precise answer is emerging to a question slightly different from the one asked.
- The metric being optimized is the easiest to measure, not the most relevant.

### Why it happens

Hard questions are often adjacent to easy questions that look similar. The mind drifts toward the easier one because progress is more visible there. The result is a confident answer to the wrong question.

### Fix

Periodically re-read the original question, especially mid-chain. Does the current direction actually answer it? If not, redirect.

For metric-related cases: ask whether the metric being optimized causally drives the outcome the user cares about, or just correlates with it. If correlate, the optimization may not transfer.

---

## Over-thinking trivia

Activating the full structured-reasoning machinery on a question that didn't warrant it. The skill produces a five-thought chain to answer something a single sentence would have addressed.

### Detection signals

- The user asked a clearly bounded factual question.
- The answer was obvious within the first thought, but the chain continued.
- The user is going to read the response and wonder why it's so long.
- The reasoning is performing rigor rather than producing insight.

### Why it happens

The skill triggered when it shouldn't have. Or it triggered correctly but kept running past the point where one thought sufficed.

### Fix

Re-check the trigger gate. Was this Type 1 or Type 2? If Type 2, exit the skill and answer directly. Apologize internally to no one — wasted effort is fine to notice and stop; pride about already-spent thoughts is the sunk-cost fallacy.

Even within the skill, once the answer is clear and the aspiration level is met, stop. "Aspiration level met" is a legitimate termination signal at any depth, including depth 1.

---

## Why these patterns matter together

Most of these patterns are subtle individually. They become dangerous when they *combine*. A typical bad chain has multiple at once: premature convergence on hypothesis A, confirmation drift to support it, sunk thoughts preventing revision, faux first-principles dressing up the result. Each one was small; together they produced a confident answer that was completely wrong.

The defense isn't memorizing all the patterns. It's developing the meta-habit of *periodically asking whether the chain is healthy.* Every few thoughts: am I making real progress? Am I leaning on verified or believed premises? Has the conclusion shifted appropriately as evidence has come in?

The patterns above are the answers to "if the chain is *unhealthy*, what specifically is wrong?" Once you've spotted which pattern is operating, the fix is usually obvious. The hard part is being willing to notice.
