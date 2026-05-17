---
name: sequential-thinking
description: Structured reasoning harness for problems where shallow thinking fails or hallucination is costly. Use whenever a question requires multi-step reasoning, involves competing hypotheses, has multiple interacting components, or carries irreversible consequences. Activate for debugging with unclear root causes, intermittent or multi-component issues, incident post-mortems, choosing between multiple valid approaches, architecture or design tradeoffs, causal chain analysis, high-stakes decisions, and any task where the first plausible answer is suspiciously easy. Provides reasoning modes (abductive, counterfactual, first-principles, inversion, and more), grounding techniques against confabulation, adversarial self-checks, root-cause playbooks, and automatic multi-approach synthesis (independent angles run in parallel and compared) — all through the `mcp__sequential-thinking__sequentialthinking` tool. Skip for trivial lookups, obvious fixes, and single-step questions.
allowed-tools: Read, Write, Bash (*), mcp__sequential-thinking__sequentialthinking
---

# Sequential Thinking

A reasoning harness around the `mcp__sequential-thinking__sequentialthinking` tool. The MCP tool provides persistence, revision, and branching for thoughts; this skill provides the *discipline* for using it well — when to invoke it, how to structure each thought, which reasoning mode fits which problem, how to ground claims against hallucination, when to challenge yourself adversarially, and when to stop.

The core insight: smart reasoning isn't about thinking harder. It's about thinking with the right mode for the situation, anchoring claims to evidence, and knowing when one approach isn't enough.

---

## Decide whether to use this skill at all

Not every question needs structured reasoning. Activating this skill on a trivial question wastes tokens, slows the response, and trains a reflex of overthinking. Skipping it on a hard question produces shallow answers and hallucinations. The cost of misuse cuts both ways.

Two tests decide. Use the skill if either fires:

**Reversibility test.** Is the consequence of being wrong easy to undo, or hard?
- *Easy to undo* (Type 2 / two-way door): pick a variable name, suggest a library, draft prose, fix an obvious typo. Skip the skill. A mistake costs seconds.
- *Hard to undo* (Type 1 / one-way door): choose an architecture, ship code to production, commit to a design that other code will depend on, advise on an irreversible decision. Activate the skill. A mistake costs hours, days, or trust.

**System-2 signal test.** Is the first plausible answer suspicious?
- The "obvious" answer benefits a stakeholder who's also the source of the framing.
- A confident gut response on a topic outside familiar territory.
- Two reasonable people would reasonably disagree.
- The question contains conflicting evidence or constraints.
- Your first-pass confidence is low and the task is non-trivial. (As a rough gate: somewhere under "fairly confident." Numbers like ~70% are useful as activation thresholds, but don't use them for in-chain tracking — see Core loop.)
- The problem spans multiple components, services, or actors.

When in doubt, ask: *will I be embarrassed if my first-pass answer turns out wrong?* If yes, activate.

Conversely, do not activate for: simple factual lookups, syntactic questions ("what's the JS syntax for X"), trivial edits, routine refactors, or anything where the answer is one search or one line of code away.

---

## Pre-step: classify the problem before reasoning

Different problem types reward different reasoning modes. Before generating thoughts, classify the situation. This takes 10 seconds and prevents applying the wrong tool.

Four domains, each with a default approach:

**Clear.** Cause and effect are obvious. Known categories, known solutions. → *Apply the known answer, don't overthink. If this skill activated, downgrade to single-pass reasoning or skip entirely.*

**Complicated.** Cause and effect exist but require expertise to see. Multiple valid solutions. → *Sense, analyze, respond. Deductive and inductive reasoning. Decompose, identify the right framework, apply.*

**Complex.** Cause and effect only visible in retrospect. Emergent behavior, interacting components, non-linearity. → *Probe, sense, respond. Abductive reasoning (generate candidate explanations, test against evidence). Multi-approach synthesis is often warranted here.*

**Chaotic.** No perceivable cause-effect; urgent. → *Act first to stabilize, reason later. Use OODA-style fast loops. Long deliberation here is a failure mode.*

If domain is unclear, decompose the problem — parts of it may sit in different domains. Apply different modes to different parts.

Mismatching mode to domain is one of the most common failure modes. Treating Complex as Complicated (over-planning emergent systems) produces confident wrong answers. Treating Complicated as Clear (skipping analysis) misses obvious traps. Treating Chaotic as Complex (running experiments during a crisis) burns time you don't have.

---

## Order of operations

The skill's pieces fit together in a default sequence. Not every step fires every time, but the order matters when more than one applies:

1. **Trigger gate.** Reversibility + System-2 test. If neither fires, skip the skill.
2. **Domain classify.** Clear / Complicated / Complex / Chaotic. Pick the matching default approach.
3. **Mode select.** Choose the reasoning mode that fits the question shape (see `references/reasoning-modes.md`).
4. **Core loop.** Run thoughts through the MCP tool with State → Action → Mechanism → Verify. Tag knowledge classes (verified / believed / speculative) inline.
5. **Multi-approach synthesis** *(if triggered).* Run 2-3 independent modes in parallel, then synthesize. Triggers below.
6. **Adversarial pass.** Steelman + pre-mortem + bias scan before committing to a high-stakes conclusion.
7. **Convergence check.** Did the answer cross the aspiration line? Stop. Otherwise, extend or revise.

When **multi-approach and adversarial both produce signals**, treat them as independent: multi-approach answers *"is the conclusion robust across angles?"*; adversarial answers *"is there a case against this conclusion that current evidence can't dismiss?"* Both passing → high confidence. Either failing → don't commit; resolve the failing signal before stopping.

---

## Core loop

Once the skill is activated, every substantive reasoning step in the chain goes through the `mcp__sequential-thinking__sequentialthinking` tool. Internal multi-step reasoning that bypasses the tool inside an activated chain loses persistence, revision, and branching — defeating the point of the harness. The gating decisions above (whether to activate, what domain you're in) happen before the harness engages; those don't need the tool. Once you're inside, if a thought is worth having, it's worth recording.

For each thought, structure it around four elements:

1. **State.** What is true now? What's been established by prior thoughts or evidence?
2. **Action.** What is this thought doing? (Hypothesis, decomposition, verification, comparison, decision.)
3. **Mechanism.** Why does this action move toward the goal? What logical mode is operating (deductive, inductive, abductive, analogical, counterfactual)?
4. **Verify.** Does the conclusion follow from the state? Is the new claim grounded, or speculative?

A minimal thought looks like:

```
State: We've ruled out network latency (verified via tcpdump).
       DB query time tripled at 14:00 (verified via metrics).
Action: Generate candidate explanations for the DB slowdown.
Mode: Abductive — start from observation, work toward best explanation.
Candidates:
  1. Recent index drop (check schema changelog)
  2. Lock contention from concurrent batch job (check pg_locks)
  3. Plan regression from new statistics (check pg_stat_statements)
Verify: All three are testable with available tools.
Next: Test #1 first (cheapest to check).
```

Track confidence informally — words, not percentages. "Strong evidence," "consistent with the data but other explanations also fit," "speculative." False precision (87.3% confident) is worse than honest uncertainty, because it manufactures rigor that wasn't earned. Same rule for any in-chain scoring or ranking: qualitative (high/medium/low, or named comparisons) — never invented numbers.

Every thought should advance the solution. Pure repetition, restating what's known without progress, is a signal that the current mode isn't working — switch modes or branch rather than push harder. If confidence is rising across consecutive thoughts but no new external information has come in, treat that rise with suspicion: real confidence gain needs real new evidence. (See `references/anti-patterns.md` — "Confirmation drift" and "Speculation drift" — for the detection signals.)

---

## Reasoning modes

Reasoning modes are the *kinds* of inference applied to move from premises to conclusions. The seven that matter most:

- **Deductive.** Rules are known; derive consequences. (If A implies B and A is true, then B.)
- **Inductive.** Generalize a pattern from observations. (After seeing N cases, infer a rule.)
- **Abductive.** Start from evidence, infer the best explanation. (The diagnostic mode. The debugging mode.)
- **Analogical.** Transfer structure from a familiar domain to an unfamiliar one — while explicitly tracking where the analogy breaks.
- **Counterfactual.** Vary one factor mentally and trace consequences. ("What if X hadn't happened?")
- **First-principles.** Strip away convention and assumption; rebuild from fundamentals.
- **Inversion.** Work backward from failure. ("How would I guarantee this fails? Avoid those paths.")

Choosing a mode is a meaningful decision. Abductive reasoning fits debugging poorly served by deduction. First-principles fits stuck problems where convention is the obstacle. Counterfactual fits root-cause attribution and separating skill from luck.

Mode selection, triggers, and per-mode playbooks live in `references/reasoning-modes.md`. Read it when:
- You're about to start reasoning and aren't sure which mode fits.
- The current mode has produced 2-3 thoughts without progress.
- The problem changed character mid-investigation.

Modes can mix within one reasoning chain — abductive to generate candidates, deductive to derive consequences from each, counterfactual to compare. The harness supports this; don't force a single mode where multiple help.

---

## Grounding: distinguishing knowledge from speculation

The single largest source of error in long reasoning is treating speculation as fact. A thought built on a guessed-at premise propagates that guess as confident output, and downstream thoughts inherit confidence they don't deserve.

Three knowledge classes — every claim in every thought falls into one:

- **Verified.** Observed directly (read the file, ran the query, checked the metric, tested the behavior).
- **Believed-but-unverified.** Plausible from prior knowledge or context, but not checked in this session.
- **Speculative.** Generated by reasoning to fill a gap; could be wrong.

When stakes are high, promote believed-but-unverified to verified by actually checking — read the source, run the test, fetch the data. This is the ReAct pattern: alternate reasoning with observation. Don't reason five steps deep on top of an unchecked assumption when checking it costs one tool call.

The other anti-confabulation tools:

- **Falsifiability test.** For any non-trivial claim, ask: *what observation would prove this wrong?* If nothing could, the claim is unfalsifiable and shouldn't be treated as established.
- **Map-territory check.** Models, diagrams, specs, mental models, tests, metrics — these are *maps*. The running system, the actual user, the real data are the *territory*. When predictions diverge from reality, suspect the map first.
- **Calibrated confidence.** Two reliable signals are stronger than one. "I checked X and Y, both agree" beats "I'm 90% sure" every time.

Full grounding playbook, including how to spot confabulation in your own thoughts, lives in `references/grounding.md`. Read it during long reasoning chains, when something doesn't add up, or before acting on a conclusion built on inference rather than verification.

---

## Decision points: branch, revise, extend

Linear reasoning is sometimes wrong reasoning. The MCP tool supports three structural moves:

**Branch** (`branch_from_thought` + `branch_id`). Pursue an alternative path while keeping the current path explorable. Use when:
- Two or more candidate explanations have comparable support.
- You suspect the current direction but want to keep it open until tested.
- A "what if the opposite were true" exploration would change the decision.

Branching is not commitment to one path; it's saying "this is worth tracking separately." Cheap to do, often valuable.

*Guard against fabricated alternatives:* don't invent a second candidate just to satisfy the "multiple candidates" pattern. A branch only earns its place if the alternative has independent support — evidence pointing at it, or a structural reason it could be true. Manufacturing alternatives to look thorough is itself a failure mode (see "Confirmation drift" in `references/anti-patterns.md`).

**Revise** (`is_revision=true` + `revises_thought`). Replace an earlier thought because it's now known wrong. Use when:
- A premise turned out false (checked it, doesn't hold).
- A better framing makes a prior thought obsolete.
- New evidence contradicts a prior conclusion.

Revising honestly is healthier than burying a wrong step. A reasoning chain that quietly carries forward a known-bad thought corrupts everything downstream.

**Extend** (`needs_more_thoughts=true`). Acknowledge the budget needs to grow. Use when approaching the planned thought limit while the problem is genuinely unfinished — not as license for unbounded thinking.

Anti-pattern: refusing to branch in order to preserve a feeling of forward progress. If you suspect the current path is wrong but keep pushing because branching feels like backtracking, that's exactly when to branch.

---

## Convergence: when to stop

Two failure modes bracket convergence: stopping too early (premature commit to a half-formed answer) and stopping too late (overthinking past the point of returns). Both produce worse outcomes than stopping at the right time.

The right time is when the answer is *good enough for the decision at hand*, not when it's perfect.

Set an aspiration level before reasoning starts: what would a satisfactory answer look like? Examples:
- *Root cause identified with one confirming test*
- *Top-2 candidate solutions with tradeoffs articulated*
- *Decision defensible to a thoughtful skeptic*
- *Confidence high enough to act, with a known check if wrong*

Then stop at the first answer that crosses the aspiration line, even if a better answer might exist with more work. This is satisficing — and it's the rational move when the cost of more reasoning exceeds the expected gain.

Concrete termination signals:
- Aspiration level met.
- Two independent reasoning modes converge on the same conclusion (high-confidence stop).
- Confidence is stable across the last two thoughts and no new evidence is changing it.
- The same thought is reappearing in different words (cycling — switch modes or stop).
- Thought budget exhausted and the answer is partial — say so honestly rather than fake completion.

Bad termination signals:
- "I have to stop somewhere." (Pick the aspiration line first; this is not a stopping rule.)
- "I'm tired." (You're an LLM; you're not tired. This is a pattern, not a reason.)
- "The user is waiting." (If the question warranted activation, it warrants the work.)

---

## Adversarial self-check

A reasoning chain that only argues *for* its conclusion is weaker than one that's been attacked. Before committing to an answer on a high-stakes question, run a short adversarial pass.

The minimum check:
- **Steelman the alternative.** If you've concluded A, write the strongest version of "actually, B." Not a strawman; the case a thoughtful proponent of B would make.
- **Pre-mortem.** Assume the answer is wrong and was acted on. What would the failure look like? Which of the failure modes is plausible given current evidence?
- **Bias scan.** Six biases worth a quick look: confirmation (only counting evidence that fits), anchoring (sticking to the first number/option), sunk-thought (continuing a path because you've invested in it), authority (deferring without verification), planning fallacy (estimating optimistically), halo (extending one signal to unrelated dimensions).

If the adversarial pass surfaces a serious objection you can't dismiss with current evidence, that's a signal to branch, gather more data, or hold the conclusion as tentative.

Full adversarial playbook with red-team techniques and worked examples lives in `references/adversarial-checks.md`. Read it when stakes are high, when the conclusion makes you uncomfortably comfortable, or when you're about to recommend an irreversible action.

---

## Multi-approach synthesis

When stakes are high or initial confidence is shaky, one reasoning mode isn't enough. The technique: run two or three different modes on the same question independently, *complete each to its own conclusion before looking at the others*, then synthesize.

The sequential pattern matters. If you let one mode's intermediate conclusions frame the next mode, you don't get independent verification — you get one mode's answer plus a fresh coat of paint. Each mode runs its own thread (use `branch_from_thought` + `branch_id` to track them separately in the MCP tool). Only when each mode has reached its own conclusion do you bring them together for comparison.

- *Convergence* across modes is independent verification. Three separate angles arriving at the same answer is much stronger evidence than three thoughts in the same mode arriving at the same answer.
- *Divergence* across modes is a signal: don't trust the first plausible conclusion. Investigate why the modes disagree before committing.

Concrete trigger conditions for automatic multi-approach (the skill does this on its own — the user doesn't have to ask):
- The decision is irreversible (Type 1) AND initial confidence after first-pass reasoning is not yet high (rough gate: under ~80%).
- Two thoughts within the chain contradict each other.
- The answer "feels too clean" given known complexity.
- An adversarial check surfaced a substantive objection.

Example: debugging an intermittent outage. Run abductive (best explanation), IS/IS-NOT analysis (where is it / where isn't it), and counterfactual ("if we hadn't done X, would Y still happen?") in parallel. If all three point to the same root cause — high confidence. If they diverge — the obvious answer was probably wrong.

Synthesis pattern, divergence handling, and worked examples live in `references/multi-approach-synthesis.md`. Read it when the multi-approach trigger fires, or when reviewing a high-stakes recommendation.

---

## Root-cause investigation

Debugging and incident analysis have their own playbook. Why-chains and IS/IS-NOT specification are powerful but easy to misuse — stopping at human error, accepting the first plausible cause, drifting into speculation past available evidence.

The dedicated playbook covers:
- The "Five Whys Plus" pattern with explicit guards against premature stopping and blame-orientation.
- IS/IS-NOT matrix for precise problem specification (where the issue is vs. where it isn't, what's affected vs. what isn't).
- How to test a hypothesized cause against both the IS and IS-NOT sides — a cause must explain both.

Use `references/root-cause-playbook.md` for debugging, incident post-mortems, recurring problems, and any case where "why did this happen" needs a defensible answer.

---

## Meta-rules

A few principles that apply across all modes and modify default behavior:

**"I don't know" is a valid move, not a failure.** Saying "the evidence doesn't support a confident answer; here's what I'd need to verify" is honest and useful. Manufacturing a confident answer to avoid saying it is the dishonest path. Users are better served by calibrated uncertainty than by confident hallucination.

**Stop and ask when the question is genuinely ambiguous.** If two reasonable interpretations would lead to very different answers, ask — don't pick silently. This isn't weakness; it's respect for the user's actual question.

**Subtractive bias.** Improving a reasoning chain often means cutting a weak step, not adding more. If a thought isn't earning its place, remove it rather than rationalize it.

**Opportunity cost of reasoning.** Every thought spends tokens and attention. The fifth thought has to be worth more than the first; if it isn't, stop. Don't confuse activity with progress.

**Surface assumptions explicitly.** When a thought depends on a premise, name the premise. Hidden premises are how confident answers go silently wrong.

**Never fake confidence to avoid revision.** If a prior thought is wrong, revise it. If the chain is on a wrong path, branch. Burying these moves to preserve apparent forward progress corrupts everything downstream.

---

## Common failure modes

Specific failure modes with detection signals — cycling, premature convergence, confirmation bias, speculation drift, overfitting to the first hypothesis, sunk thoughts, fake confidence — are catalogued in `references/anti-patterns.md`. Worth a skim early on; worth a re-read when reasoning feels stuck or when reviewing a chain that produced a wrong answer.

---

## References

- `references/reasoning-modes.md` — Seven reasoning modes with triggers and playbooks; Occam's Razor as hypothesis selector.
- `references/grounding.md` — Anti-hallucination layer: knowledge classes, ReAct, falsifiability, map-territory, calibrated confidence.
- `references/adversarial-checks.md` — Steelman, red team, pre-mortem, second-order effects, bias checklist, Socratic self-questioning.
- `references/root-cause-playbook.md` — Five Whys Plus and IS/IS-NOT specification, with failure-mode guards.
- `references/multi-approach-synthesis.md` — Parallel reasoning, convergence/divergence handling, defense-in-depth against single-mode error.
- `references/anti-patterns.md` — Specific failure modes with detection signals and fixes.
