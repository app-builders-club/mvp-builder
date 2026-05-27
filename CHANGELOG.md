# Changelog

All notable changes to MVP Builder will be documented in this file. The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [0.1.2] - 2026-05-27

### Changed

**Rules**
- `ios.md` Parallelization — reversed default: tests run single-threaded (serialized). Apply `.serialized` to root `@Suite` so all suites and parameterized cases execute one at a time. Deterministic output under serial execution required. Disable parallelization at test plan / scheme level.
- `ios.md` Thread Sanitizer — demoted from required CI job to "useful for production code, not required for these tests since they don't run concurrently"
- `ios.md` Testing strategy — "Unit tests only. Never write UI tests that run on simulator or device" (was: "Unit tests for core logic. UI tests only where unit tests aren't possible")

### Removed

- `ios.md` XCUITest (UI Automation) section — `accessibilityIdentifier` guidance, `waitForExistence(timeout:)` waits, `--uitesting`/`--reset-state` launch args, behavior-over-implementation assertions. UI testing no longer part of the iOS rule set.

## [0.1.1] - 2026-05-17

### Added

**Skills**
- `sequential-thinking/references/` — 6 references: `reasoning-modes.md` (7 inference modes + Occam's Razor), `grounding.md` (knowledge classes, ReAct, falsifiability, map-territory), `adversarial-checks.md` (steelman + pre-mortem + red team + bias checklist), `root-cause-playbook.md` (Five Whys Plus + IS/IS-NOT matrix), `multi-approach-synthesis.md` (parallel reasoning with convergence/divergence handling), `anti-patterns.md` (10 failure modes with detection signals)

### Changed

**Skills**
- `sequential-thinking` — restructured around `mcp__sequential-thinking__sequentialthinking` tool. SKILL.md: trigger gate (Reversibility + System-2), Cynefin classification, order of operations, State→Action→Mechanism→Verify thought structure, branch/revise/extend with fabrication guards, satisficing convergence
- `sequential-thinking` — hallucination defense: per-thought knowledge-class tagging (verified/believed/speculative), confidence-rise-without-evidence guard, mode-switch recheck, qualitative-only in-chain scoring

### Removed

- `sequential-thinking` legacy: rigid scoring (+2/-3 points), thought-budget percentages, `$ARGUMENTS` templates, in-chain confidence percentages

## [0.1.0] - 2026-04-17

### Added

- `system-design` skill — architectural trade-off framework: triage (data-heavy, real-time, offline, media, integration, UI iteration), question bank with recommended defaults, synthesizes decisions with rejected alternatives and testable NFRs
- `system-design/references/` — 9 decision-tree references (nfr-taxonomy, pagination, caching, realtime, offline-and-data, media-upload, api-selection, server-driven-ui, cross-platform)

### Changed

- `/docs:plan` Phase 0.4 — invokes `system-design` skill before Sequential Thinking; user confirms every architectural decision via multiple-choice dialogue with defaults, no unresolved questions propagate to research.md
- `/docs:plan` research.md template — Key Decisions format extended with `Rejected: [alternative + reason]`; new optional `## Non-Functional Requirements` section
- `/docs:plan` — validation checks rejected alternatives present; new error cases for unresolved System Design questions and missing rejected alternatives

## [0.0.9] - 2026-04-15

### Added

- `CLAUDE.md`: Goal Transformation, Surgical Changes sections; subagent key-files convention
- `design.md`: Pipeline Artifacts Consumption — token mapping, style guide bindings, screen references, component patterns
- `frontend.md`, `ios.md`: Design System References — platform-specific token mapping from design-system.md
- `code-analyzer`: Step 3 "Trace Patterns" — execution path tracing, abstraction layers, reuse opportunities, key files output

### Changed

- `CLAUDE.md`: Simplification rewritten with concrete anti-patterns; When uncertain rewritten with explicit assumption surfacing
- `settings.json`: extended env vars for tool configuration, enabled LSP and PR review plugins

## [0.0.8] - 2026-04-13

### Added

**Skills**
- `figma-extractor` — replaces `figma-design-extraction`. Three-level extraction architecture (Level 1: quick MCP, Level 2: Plugin API scripts, Level 3: library search + component properties). New tools: `use_figma`, `search_design_system`, `get_context_for_code_connect`.
- `figma-extractor/scripts/` — read-only Plugin API scripts for Level 2: `extractVariableMetadata.js` (collections, modes, codeSyntax, scopes, aliases), `extractStyles.js` (text + effect + paint styles), `extractComponentInventory.js` (component sets + property definitions).
- `figma-extractor/references/` — `search-strategies.md` (query patterns for library search), `data-structures.md` (output schemas for all extraction levels).

**Agents**
- `design-setup` — converted from command to agent. Multi-phase execution (Load → Validate → Extract → Resolve → Generate) with Sequential Thinking for conflict resolution, Context7 for framework docs, Figma Extractor skill for extraction. Source priority: JSON > Figma > CSS > markdown.

### Changed

**Documentation**
- README.md: removed `design-generate` from pipeline diagram, Phase 1 table, and Agents section. `design-setup` moved from commands to agents. Figma roundtrip simplified to `design-setup ↔ Figma` (no intermediate agent).

### Removed

- `figma-design-extraction` skill — replaced by `figma-extractor` with Level 1/2/3 architecture
- `design-generate` agent — removed from README (was deleted from repo in previous work)
- `/docs:design-setup` command — replaced by `design-setup` agent

## [0.0.7] - 2026-04-10

### Added

**Rules**
- `authentication.md` — restored as standalone rule (was merged into backend.md in v0.0.6). All platforms: Next.js, Express, React Native, iOS, Android, Flutter, Browser Extension, Python.
- `ios.md` — `paths` frontmatter (`**/*.swift`, `**/*.xcodeproj/**`). Loads only when working with Swift files — saves context in web projects.
- `backend.md` — `paths` frontmatter (`**/prisma/**`, `**/api/**`, `**/*.py`). Added API Design section (error format, pagination, versioning, rate limiting). Added Python-specific rules (Pydantic, type hints).
- `frontend.md` — `paths` frontmatter (`**/*.tsx`, `**/*.jsx`, `**/*.css`). Added Testing section (Vitest + React Testing Library + Playwright + msw).
- `docker.md` — added Python containerization (slim image, Poetry export, Gunicorn/Uvicorn, collectstatic).
- `code-quality.md` — added cross-platform precedence note.

### Changed

**Rules**
- `frontend.md` — removed all design duplicates: typography table, UI components table, animations table, assets table, color system principles, accessibility principles, semantic color HEX values, Quality Gate. Design decisions now single-sourced in `design.md`.
- `code-quality.md` — removed Verification Order (single-sourced in CLAUDE.md), removed Code Review section (moved to review agent).
- `backend.md` — removed Authentication table (now in standalone `authentication.md`).

**Agents**
- `review` — added Code Review Standards section (from code-quality.md): high-signal flagging rules, confidence threshold, review scope.

**Documentation**
- README.md: "Skills over Agents" → "Rules + Skills + Agents" principle. "Skills System" → "Rules & Skills" section with rules table and paths. Installation: hooks → rules.

### Audit Summary

Full consistency audit of CLAUDE.md + all rules:
- **7 duplicate groups** resolved (verification order ×4, typography ×2, UI components ×2, animations ×2, assets ×2, color system ×2, accessibility ×2)
- **1 contradiction** fixed (semantic color HEX in frontend.md vs "never hardcode" in design.md)
- **5 gaps** filled (authentication standalone, frontend testing, backend API design, Python docker, code-quality cross-platform note)
- **3 path-scoped rules** added (ios, backend, frontend) — context savings for non-matching projects

## [0.0.6] - 2025-03-04

### Added

**Rules**
- `git.md` — branch naming conventions, commit format, secret protection, safety guards. Replaces `git` skill.
- `authentication.md` — auth library decisions per platform (Next.js, Express, mobile, Python, browser extensions). Replaces `backend-auth-js` and `backend-passport-js` skills.
- `backend.md` — stack decisions for auth, ORM, validation, API layer, logging, testing + non-negotiable rules. Replaces all `backend-*` skills.
- `frontend.md` — UI component selection, animation library decisions, asset strategy, color/typography standards, SSR rules, quality gates. Replaces all `frontend-*` skills.
- `docker.md` — containerization standards for Node.js: multi-stage builds, docker-compose, security rules. Replaces `docker-node` skill.

### Changed

**Rules (CLAUDE.md)**
- Removed `Session Continuity` section (HANDOFF.md workflow)
- Renamed to `In-Code Documentation` — `AICODE-NOTE/TODO/FIX` prefixes retained, scoped explicitly to in-code usage
- `Required Context` simplified — removed SessionStart hook reference

**Settings**
- `settings.json`: removed `hooks` section, added `autoMemoryEnabled: true`

### Removed

- `session-start.sh` — replaced by Claude Code Auto Memory
- `HANDOFF.md` — replaced by Claude Code Auto Memory
- `skills-registry` skill — skill routing no longer needed with rules-based approach
- `/generate:agent` command — removed custom agent generation

## [0.0.5] - 2025-03-03

### Added

**Agents**
- `design-generate` — validates HTML references against design tokens and design-system.md, fixes inconsistencies, serves locally, and captures into Figma as editable layers. Completes the Figma roundtrip: design-setup extracts from Figma, design-generate pushes back.

**Skills**
- `figma-design-extraction` — extracts design tokens, screen structure, and visual references from Figma files. Source-tracked output (figma-variables vs figma-context) for downstream conflict resolution.
- `figma-design-generate` — captures UI and sends to Figma as editable design layers using generate_figma_design MCP tool. Handles new file, existing file, and clipboard targets.

**Templates**
- `design-setup-template.md` — structured templates for design-system.md, style-guide.md, screen index, and review checklist. MODEL INSTRUCTION blocks separate fill logic from output.

### Changed

**Commands**
- `/docs:design-setup` — added `model: opus`, fixed `Bash(*)` syntax, split CSS/HTML token priority into separate levels, specified `create_design_system_rules` input parameters, removed `/` prefix from MCP tool references in body

**Documentation**
- README.md: added design-generate to pipeline diagram (Figma roundtrip), Phase 1 table, and Agents section (split into Define/Build phases)

## [0.0.4] - 2025-02-18

### Added

**Commands**
- `/docs:design-setup` — normalizes raw design generator output into structured references (design-system.md, style-guide.md, tokens/). Supports Figma extraction via MCP tools (get_metadata, get_screenshot).
- `/docs:ui` — generates UI specifications: component trees, DS mapping, layout structure, visual state mapping. Bridges ux.md behavior and plan.md implementation.

**References Pipeline**
- `ai-docs/references/` directory created by `/docs:prd`, populated by user, normalized by `/docs:design-setup`, consumed by `/docs:feature`, `/docs:ux`, `/docs:ui`, `/docs:plan`
- Typed reference loading across all downstream commands with specific usage guidance per reference type

## [0.0.3] - 2025-02-08

### Added

**Hooks**
- `session-start.sh` — SessionStart hook auto-injects project context (HANDOFF + PRD + FEATURES + README) into Claude's context window. Zero tool calls on session start.

**Rules (CLAUDE.md)**
- Context Handoff: update HANDOFF.md after TDD cycles, keep max 2 previous entries
- Required Context: changed from "Load these documents" to "auto-loaded via SessionStart hook, read manually if not in context"
- AI Documentation Structure: added HANDOFF.md to graph

**Commands**
- `/docs:memory` — dual-mode: with feature path (existing behavior) or without arguments (full project rescan for changes outside feature scope)
- `/docs:plan` — Phase 0.2: conditional codebase scan via Code Analyzer skill before planning. Reuse existing modules, follow established patterns.

### Changed

**Commands**
- `/docs:plan` — removed inline bash from Phase 0.2, delegates fully to Code Analyzer skill

**Documentation**
- README.md: added Session Continuity section, HANDOFF.md in document structure, hook mention in installation
- README.md: updated Memory System principle with HANDOFF and SessionStart hook

## [0.0.2] - 2025-01-27

### Changed

**Rules (CLAUDE.md)**
- TDD: verify test fails for expected reason before implementation
- Verification Order: build → types → lint → tests sequence
- New Simplification section: minimal diff, fight complexity bias
- New Self-Check section: verify claims, no "should/probably" completions
- Plan Mode: concise plans with unresolved questions list

**Agents**
- `feature-fix`: added Quality Gates step before test suite

## [0.0.1] - 2025-12-19

### Added

**Commands**
- `/docs:prd` — Interactive PRD generation with validation
- `/docs:feature` — Feature specification from PRD or user input
- `/docs:clarify` — Targeted clarification dialogue for specs
- `/docs:ux` — Platform-aware UX specifications
- `/docs:plan` — Technical implementation planning with artifacts
- `/docs:tasks` — TDD task generation (INIT + RED-GREEN cycles)
- `/docs:validation` — Verification checklists with traceability
- `/docs:review` — Implementation review with feedback loop
- `/docs:memory` — Code map generation for session continuity

**Agents**
- `feature-setup` — Infrastructure scaffolding (INIT tasks)
- `feature-tdd` — TDD implementation (RED-GREEN cycles)
- `feature-fix` — Review-driven fixes (one error at a time)
- `/generate:agent` — Custom agent generation from task description

**Skills**
- `skills-registry` — Dynamic skill matching (see `.claude/skills/skills-registry/SKILL.md` for full list)

**Core**
- Document-Driven Development pipeline
- Full traceability (FR-XXX → TEST-XXX → IMPL-XXX → CHK → REV)
- Feedback loop with self-verification
- Skills Registry for automatic skill matching
- Cross-platform installation scripts (bash, PowerShell)

[0.1.2]: https://github.com/petbrains/mvp-builder/releases/tag/v0.1.2
[0.1.1]: https://github.com/petbrains/mvp-builder/releases/tag/v0.1.1
[0.1.0]: https://github.com/petbrains/mvp-builder/releases/tag/v0.1.0
[0.0.9]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.9
[0.0.8]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.8
[0.0.7]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.7
[0.0.6]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.6
[0.0.5]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.5
[0.0.4]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.4
[0.0.3]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.3
[0.0.2]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.2
[0.0.1]: https://github.com/petbrains/mvp-builder/releases/tag/v0.0.1
