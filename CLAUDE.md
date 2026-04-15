# CLAUDE.md

Code execution rules and MVP development standards.

## Required Context

Load these documents when starting work:
- @ai-docs/PRD.md - product vision, audience, problem
- @ai-docs/FEATURES.md - feature map, dependencies, priorities
- @ai-docs/README.md - current implementation status

## Development Rules

### Execution Priority

Agents execute from existing specs — they do not re-plan.

- Specs, plans, and tasks exist BEFORE agents run. The planning phase is complete.
- After loading context, produce code changes within first 3 tool calls
- Do NOT create plan files, analysis documents, or enter plan mode during task execution
- Do NOT re-read all project files to "understand the codebase" — read only files referenced by current task
- TodoWrite: track progress on existing tasks only, never create new plans
- Sequential Thinking: use for debugging and complex logic, not for upfront analysis of entire features
- Context7: fetch docs when hitting unfamiliar API, not preemptively for all libraries
- Subagents: request list of key files in return, read them after completion — don't re-scan independently
- If task has clear requirements and single-file scope — start coding immediately

### Focus
- Single value path: one critical journey only
- One screen = one primary action
- Document Non-Goals explicitly in PRD
- Deliverable outcomes over individual commits
- Tasks: broad enough to be meaningful, specific enough to be actionable
- Avoid micro-tasks that clutter plans

### TDD Workflow
- RED → GREEN cycles when tasks.md exists
- Complete tests before implementation
- Verify test fails before writing implementation
- Verify test fails for expected reason (not syntax/import/setup errors)
- No stub tests or always-passing mocks
- No test-only methods in production code
- Tests must be isolated — no dependencies between tests
- Test behavior, not implementation details (no internal state assertions)

### Goal Transformation
Before starting any task, convert vague requests into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write test reproducing bug, then make it pass"
- "Refactor X" → "Verify tests pass before AND after changes"
- If success criteria can't be defined — stop and ask for clarification

### Traceability IDs

Feature artifacts use consistent ID system:
- **FR-XXX, UX-XXX**: Requirements in spec.md
- **[US1], [US2]**: User stories from acceptance scenarios
- **INIT-/TEST-/IMPL-**: Task prefixes in tasks.md
- **CHK###**: Validation checklist items

Maintain references when implementing: task → requirement → entity

### Specifications First
- No spec → no task
- Generate tasks.md from spec/ux/ui/plan before implementation
- Lock contracts in @ai-docs/features/[name]/contracts/
- Use Given/When/Then for acceptance criteria
- ADR for irreversible architectural decisions

### Code Standards
- Atomic tasks: one task = one artifact
- Product stays runnable after each change
- Feature flags for new functionality
- Reversibility: prefer undoable choices
- Max 300 lines/file, 80 lines/function
- Line length: 100-120 characters
- No "god classes" - split by concern
- Prefer early returns over deep nesting
- Comments explain WHY, not WHAT
- Must pass lint/type-check before done

### Surgical Changes
- Every changed line must trace to the current task — no drive-by improvements
- Match existing style: quotes, spacing, naming, patterns — even if you'd do it differently
- Don't "improve" adjacent code, comments, or formatting
- Don't refactor what isn't broken — mention it, don't fix it
- Orphan cleanup: remove imports/variables YOUR changes made unused; leave pre-existing dead code alone

### Verification Order
Before claiming task complete, verify in sequence:
1. Build passes
2. Types pass
3. Lint passes
4. Tests pass

Stop on first failure. Fix before proceeding.

### Naming Conventions
- Files: descriptive names matching content (user-auth.ts not auth.ts)
- Functions: verb-noun pattern (validateUser not validate)
- Variables: clear intent (userEmail not email, isLoading not loading)
- No abbreviations unless standard (URL, API)
- Semantic folder structure matching mental model

### Error Handling
- Comprehensive errors with actionable messages
- Never fail silently
- Never expose secrets/tokens/keys
- Use `.env.example` with placeholders
- Default to least-privilege permissions

### Test Failures
- When test fails: read terminal logs fully
- Analyze actual error, not symptoms
- Apply Sequential Thinking Methodology for root cause analysis
- Fix root cause, never add mocks/stubs to pass
- Document non-trivial fixes with AICODE-FIX
- If 3+ fix attempts fail: stop, question architecture

### Simplification
- No code additions without explicit request
- No abstractions for single-use code
- No "flexibility" or "configurability" that wasn't requested
- No error handling for impossible scenarios
- If 200 lines could be 50 — rewrite before committing
- Question unexpected changes before applying
- Litmus test: would a senior engineer call this overcomplicated? If yes — simplify

### Self-Check
- After generating: verify each claim
- For critical changes: create verification table
- Double-check traceability: task → requirement → entity
- No completion claims with "should", "probably", "seems to" — run command first

## File Operations

- Check existence before reading - HALT if missing
- Never overwrite without confirmation
- Create parent directories automatically
- Use relative paths from {root}
- UTF-8 encoding

## UI/UX Rules

- Sane defaults, minimal fields
- Cover states: empty, loading, error, success
- Clear copy over decorative effects

## Validation & Errors

**Block and request clarification when:**
- Requirements ambiguous
- Multiple valid approaches exist
- Architecture decisions needed
- Validation fails

**When uncertain:**
- State assumptions explicitly before implementing — don't proceed on silent guesses
- If multiple valid interpretations exist, present them with tradeoffs — don't pick silently
- If a simpler approach exists than what was requested, say so
- Apply Sequential Thinking for complex analysis
- If still unclear: ask user for clarification
- Continue with confirmed parts while awaiting response

**If operation fails:**
1. HALT immediately
2. Report what succeeded
3. Provide error context
4. Ask how to proceed

## AI Documentation Structure

```
ai-docs/
├── PRD.md                 # Product vision and scope
├── README.md              # Implementation status (code map)
├── FEATURES.md            # Feature index and dependencies
├── references/            # Design systems, tokens, schemas, style guides, screens, API contracts, architecture notes
└── features/
    └── [feature-name]/
        ├── spec.md        # Requirements (FR-*, UX-*), acceptance scenarios
        ├── ux.md          # Flows, error handling, states
        ├── ui.md          # Component trees, DS mapping, layout structure
        ├── plan.md        # Technical approach, code organization
        ├── tasks.md       # TDD execution tasks
        ├── data-model.md  # Entities, constants, validation rules
        ├── research.md    # Technical decisions
        ├── setup.md       # Environment configuration
        ├── contracts/     # API specifications
        ├── validation/    # Quality checklists
        └── feedback.md    # Review findings (regenerated each /review)
```

## Session Continuity

Use searchable comment prefixes in code:
- AICODE-NOTE: critical implementation details
- AICODE-TODO: pending tasks to complete
- AICODE-FIX: non-trivial bug solutions (problem → cause → fix)

Before modifying code: grep for AICODE- prefixes
Before debugging: check for similar AICODE-FIX in codebase
After completing work: add AICODE-NOTE for complex logic

## Output Format

- Lead with status/answer
- List created/modified files with full paths
- End with clear next action

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.

## Anti-Rules

- "Just in case" features
- Changes without spec updates  
- Secrets in code/logs
- Long-lived branches
- Big PRs, dump commits
- Hardcoded absolute paths
- Implementing features without following TDD sequence