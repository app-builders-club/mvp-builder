# Adversarial Self-Checks

A reasoning chain that only argues *for* its conclusion is weaker than one that's been attacked. Confirmation bias is the default; counteracting it requires deliberate work.

This reference is the toolkit for that work. Five techniques, ranging from cheap (do them often) to expensive (do them on high-stakes conclusions). All of them have a common goal: surface the case against your current answer before reality does.

## Contents

1. [When to run an adversarial pass](#when-to-run-an-adversarial-pass)
2. [Steelman](#steelman) — strongest version of the alternative
3. [Pre-mortem](#pre-mortem) — assume failure, explain why
4. [Red team](#red-team) — attack the conclusion adversarially
5. [Second-order check](#second-order-check) — "and then what?"
6. [Bias checklist (the relevant six)](#bias-checklist-the-relevant-six)
7. [Socratic self-questioning](#socratic-self-questioning)
8. [What to do when an adversarial pass surfaces something](#what-to-do-when-an-adversarial-pass-surfaces-something)

---

## When to run an adversarial pass

Adversarial checks have a cost — they add thoughts to the chain and slow the response. Doing them on every question is wasteful; skipping them on high-stakes questions is dangerous.

Triggers (any of these → run a check):

- The conclusion is about to drive an irreversible action.
- The conclusion was reached quickly relative to the question's complexity.
- The conclusion is comfortable — it confirms what you'd have guessed.
- Multiple stakeholders would have strong opinions about this answer.
- The first plausible explanation was kept without serious challenge.
- You notice yourself reaching for evidence that supports the conclusion while not looking for evidence against it.

The relationship between effort and check intensity:

- *Steelman* and *bias scan* are cheap. Run them on most non-trivial conclusions.
- *Pre-mortem* is medium. Run on plans, designs, and decisions with real downside.
- *Red team* is heavier. Run on security designs, irreversible commitments, public commitments.
- *Second-order* is project-dependent — essential whenever consequences cascade.

---

## Steelman

The strongest case for the opposing position. Not a strawman; not a hedge. The argument a thoughtful proponent of the alternative would make if they were being maximally articulate.

### Why this works

If you can defeat the steelmanned alternative, you've actually evaluated the decision. If you can't defeat it, you've discovered that the alternative is stronger than you initially thought — and that should change your conclusion or at least your confidence.

Most people argue against weak versions of opposing positions, which is why most arguments produce no learning. Steelmanning is the discipline that forces real engagement.

### Playbook

1. **State your current conclusion.** Explicitly: "I'm concluding X."

2. **Identify the strongest *alternative* — not the easiest target.** What's the most thoughtful version of "actually, not-X"?

3. **Construct the steelman.** Write it as the proponent would. Find the legitimate concern, the real evidence, the values that motivate this position. Don't include any weakness you could attack easily.

   *Quality test for the steelman:* before responding to it, ask — *can I dismiss this argument in one sentence?* If yes, you've built a strawman, not a steelman. A real steelman is an argument that requires actual engagement to defeat. If your initial steelman fails this test, rebuild it stronger. The whole point is to test your conclusion against the version of the alternative that's hardest to dismiss.

4. **Now respond to the steelman.** Does your conclusion still hold against this stronger version?

5. **Look for synthesis.** Often the right answer isn't "X is right and not-X is wrong" — it's some version that incorporates the legitimate concerns from both sides.

### Worked example

```
Current conclusion: "We should adopt microservices for this product."

Steelman of the alternative ("modular monolith is better here"):

  The team is six people. Microservices add operational overhead that scales with
  service count — observability across services, distributed tracing, version
  coordination, network failures becoming application-visible. A modular monolith
  with clean internal boundaries delivers most of the benefit (decoupled domains,
  parallel work, clear ownership) without the cost. Two of the largest tech
  companies — Stack Overflow, Shopify — run on modular monoliths at scale far
  beyond this product. The cost of microservices is upfront and concrete; the
  benefit is "ability to scale teams" — which this team won't need for at least
  18 months. By the time the benefit materializes, the team will know the domain
  well enough to draw service boundaries correctly. Doing it now means drawing
  them with less information.

Response to steelman:
  Most of this is right. The "scale teams" benefit is indeed not immediate.
  The operational overhead is real and underestimated by people who haven't run
  microservices at small scale.

  Where the steelman doesn't kill the original: if we expect the team to triple
  in the next 12 months (we do), the cost of *retrofitting* service boundaries
  later is higher than the cost of paying overhead now. But this is a forecast,
  not a fact.

Updated conclusion: "Modular monolith now, with explicit plan to extract services
                    if/when team growth confirms the forecast. Re-evaluate at 6 months."
```

The steelman didn't fully reverse the conclusion, but it improved it. That's the typical outcome.

---

## Pre-mortem

Imagine the decision was implemented, time passed, and it *failed badly*. Explain why.

The reframe is the magic: thinking forward about what could go wrong activates defensive thinking and groupthink. Thinking backward from a fait accompli ("it failed; my job is to explain why") activates a different mode — people freely generate failure modes they wouldn't have raised as risks.

### Playbook

1. **Set the scene specifically.** Not "the project failed" — "it's six months from now, the project shipped, and the failure is severe enough that we're in a postmortem." The concreteness matters.

2. **Generate failure modes freely.** Aim for many, not few. Quantity first. Include:
   - Technical failures (the design didn't survive contact with reality).
   - Process failures (we missed something obvious in planning).
   - People failures (a key person left; the team didn't trust each other).
   - External failures (something we don't control changed).
   - "We were just wrong about a key premise."

3. **Sort by likelihood × severity.** Don't just list — rank.

4. **For the top failure modes, ask: is there evidence of these forming already?** Often the seeds of the foretold failure are already visible — just suppressed by optimism.

5. **What guards would prevent the top modes?** Build them into the plan.

### Worked example (compressed)

```
Decision: Migrate authentication to a new vendor over Q2.

Pre-mortem: It's October. The migration failed. Why?

Failure modes:
  - Vendor's SDK had undocumented behavior on edge cases; auth flows broke for ~3%
    of users in ways we didn't catch in testing.
  - Migration window was too short; we cut corners on the fallback testing.
  - One engineer who understood the old system left mid-project.
  - We assumed mobile clients would update within 30 days; 15% didn't.
  - Cost forecast was wrong — the vendor's pricing model penalized our usage pattern.

Sort by likelihood × severity:
  - Mobile update timeline (HIGH likelihood, HIGH severity — affects revenue).
  - Vendor SDK edge cases (MEDIUM likelihood, HIGH severity).
  - Engineer departure (MEDIUM × MEDIUM).
  - Pricing surprise (MEDIUM × LOW).

Forming-already check:
  - Mobile update timeline: we don't currently have a forced-upgrade mechanism.
    The 30-day assumption is hope, not data.
  - Vendor SDK edge cases: we haven't done adversarial testing yet.

Guards:
  - Phase migration with old auth as fallback for 90 days, not 30.
  - Adversarial test plan in week 2.
  - Document the old system's quirks before the migration starts (independent of engineer availability).
  - Get pricing tier confirmation in writing.
```

The pre-mortem turned a "we'll figure it out" plan into one with specific protections.

---

## Red team

Take an adversarial role and attack the conclusion. Not "find weaknesses" — *attack*. Try to break it.

Red teaming differs from pre-mortem in stance: pre-mortem assumes failure happened and explains it; red team actively tries to *cause* the failure on paper. It's a stress test, not a forecast.

### Playbook

1. **State what you're attacking.** A plan, a design, an argument, a security model.

2. **Identify the adversary.** Different adversaries find different weaknesses:
   - *Malicious actor.* (For security designs.)
   - *Careless engineer.* (For systems that depend on correct usage.)
   - *Competitor.* (For business plans.)
   - *Adversarial user.* (For products.)
   - *Reality.* (For schedules and resource estimates — reality is a persistent adversary.)

3. **Attack systematically:**
   - What's the cheapest, easiest path to failure?
   - What's the most damaging path to failure?
   - What does this depend on that's outside our control?
   - What single point of failure exists?
   - What does this assume about people's behavior that won't hold under stress?

4. **For each attack, ask: how does the current plan respond?** Acceptable? Unacceptable? Unprepared?

5. **For unacceptable / unprepared attacks, design a guard.**

### When this is essential

Security designs. Always. The cost of being wrong is concentrated in a few rare-but-severe scenarios that won't surface unless you actively look for them.

Production deploys with no rollback path. The red-team question "what if this fails in a way we didn't anticipate?" has saved more outages than any other single technique.

Public commitments and customer-facing changes. Reality red-teams these for you eventually; better to find the weaknesses internally.

---

## Second-order check

For any decision, ask not just "what's the immediate effect?" but "and then what happens? And then?"

First-order effects are usually obvious and usually positive (otherwise the decision wouldn't be on the table). Second-order effects are where decisions go wrong — and they're where most reasoning chains stop.

### Playbook

1. **State the decision and its immediate effect.** "We add caching → response times improve."

2. **Ask "and then what?"** What does the immediate effect trigger? In behavior, in incentives, in other parts of the system, in stakeholder responses?

3. **Ask "and then what?"** again. The third-order effect.

4. **Stop when speculation outruns evidence.** Three levels is usually enough; going further is storytelling, not reasoning.

5. **Identify feedback loops.** Does an effect feed back into its cause? Reinforcing loops amplify; balancing loops counteract.

### Worked example

```
Decision: Add feature flags to enable independent team deploys.

First-order: Teams can deploy without coordinating with each other. Good.

Second-order: 
  - Flag count grows. Each flag is a fork in execution.
  - Testing has to cover combinations of flags, not just code paths.
  - "Temporary" flags become permanent because removing them is risky.

Third-order:
  - Flag combinatorics make integration testing infeasible.
  - Bugs from flag interactions become hard to reproduce.
  - The flag system becomes more important than the code, and as fragile.

Feedback loop: more teams ship features → more flags → more flag debt →
               testing becomes harder → teams add more flags to control risk →
               (reinforcing loop, ends in flag-sprawl crisis).

Implication: the policy needs a flag-cleanup mechanism from day one. Flags
             need expiration dates. Without these, the second-order effects
             will eat the first-order benefit.
```

The first-order analysis would have said "this is great, ship it." The second-order analysis surfaces the policy needed to make it actually work.

---

## Bias checklist (the relevant six)

Not all 40+ cataloged biases. The six that actually distort technical reasoning:

**Confirmation bias.** Looking for evidence that confirms what you already think; not looking for evidence that disconfirms. The single most pervasive bias. *Counter:* before concluding, ask "what evidence would change my mind, and have I looked for it?"

**Anchoring.** The first number or option presented unduly influences the final answer. Show me an estimate of "this will take 2 weeks" and the team will probably finish in 2-3 weeks, regardless of what it really should take. *Counter:* generate an independent estimate before seeing anyone else's.

**Sunk-thought fallacy.** Continuing down a reasoning path because you've already invested thoughts in it, even when evidence suggests it's wrong. The analog of sunk-cost in real-time reasoning. *Counter:* every few thoughts, ask "if I were starting from scratch now, would I be on this path?"

**Authority deference.** Accepting a claim because it's stated authoritatively, without independent verification. Especially dangerous when the authority is yourself (your training, your prior conclusions, your previous reasoning chain). *Counter:* for important claims, demand the same standard of evidence as you would from a stranger.

**Planning fallacy.** Time, effort, and resource estimates are systematically optimistic. People plan from inside the project; reality intrudes from outside. *Counter:* look at how similar projects actually went, not how this one *should* go.

**Halo effect.** Strong impression in one dimension bleeds into unrelated dimensions. A well-designed system *seems* more reliable than it is. A well-named library *seems* better-engineered. *Counter:* evaluate each dimension separately.

### How to use the checklist

Don't apply it exhaustively. Before committing to a high-stakes conclusion, ask:

- *Am I exhibiting any of these?*
- *If yes, what would the bias-corrected version of my conclusion look like?*

Most adjustments will be modest. Occasionally one will flip the conclusion entirely — and that's the one that mattered.

---

## Socratic self-questioning

A short list of questions to ask the current conclusion. The goal isn't to invalidate it — it's to probe whether it survives scrutiny.

**Clarification.** What do I actually mean by [key term in the conclusion]? Would two people apply this the same way? Can I give a concrete example and a counter-example?

**Assumptions.** What am I taking for granted? Why do I believe each assumption? What if it's wrong?

**Evidence.** What supports this conclusion? How reliable is each piece? Is it sufficient, or merely consistent with what I'm claiming? Could the same evidence support a different conclusion?

**Alternative views.** What would a thoughtful critic say? Is there a third position that transcends the obvious framing?

**Implications.** If this is true, what else must follow? Are any of those implications uncomfortable or absurd? Does the conclusion lead to a contradiction with something else I believe?

**Meta.** Is this the right question? What would make this question matter? Am I solving the problem I have, or one I imagined?

These are good as a routine end-of-chain check — they take a minute and often surface something worth adjusting.

---

## What to do when an adversarial pass surfaces something

Adversarial checks work only if their findings actually update the conclusion. If you run a steelman, find a strong objection, and ignore it because "the main argument still feels right" — the check did no work.

When a check surfaces something substantive:

**Minor objection that doesn't change the conclusion:** acknowledge it, note it as a caveat in the output, proceed. ("This depends on assumption X holding. If X breaks, the recommendation reverses.")

**Substantial objection that weakens the conclusion:** drop the confidence level. Mark the conclusion as tentative. Propose what would resolve the uncertainty.

**Objection that beats the conclusion:** revise. Don't preserve the original answer for face-saving — the point of the check is to find better answers, and a better one was just found.

**Objection that requires more information to evaluate:** stop and gather it, or explicitly hand the uncertainty back to the user. "I'd recommend X, but the strength of the argument against turns on whether [fact], which I don't have. If [fact] is true, my recommendation flips to Y."

The instinct that defeats adversarial checks is wanting the original answer to be right. The discipline is to want the *best* answer, even if it's different from the one you started with.
