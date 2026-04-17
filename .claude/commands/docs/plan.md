---
description: Execute the implementation planning workflow.
allowed-tools: Read, Write, Bash (*), mcp__sequential-thinking__sequentialthinking, mcp__context7__resolve-library-id, mcp__context7__get-library-docs
---

# Instructions

Generate technical implementation plan by filling plan-template.md based on validated specifications.
Creates minimal supporting artifacts that complement (not duplicate) existing documentation.

**Tools Usage:**
- `Read`: For loading spec.md, ux.md, ui.md, reference files, and existing planning documents
- `Write`: For saving plan artifacts and research notes
- `Bash`: For directory creation and file verification

**Skills:**
- Code Analyzer: For loading existing codebase structure, dependencies, and reusable modules
- System Design Decision Tree: For architectural trade-offs (pagination, caching, real-time, offline, media, API protocol) — triage, question bank, decision synthesis
- Sequential Thinking Methodology: For multi-step reasoning that is not already covered by System Design trade-offs (library compatibility, version selection, integration risks)
  - Tool: `/mcp__sequential-thinking__sequentialthinking`
- Context7 Documentation Retrieval: For library documentation and compatibility verification
  - Tools: `/mcp__context7__resolve-library-id`, `/mcp__context7__get-library-docs`

**Template:**
- Plan: @.claude/templates/plan-template.md

**Project context:**
- PRD: @ai-docs/PRD.md
- Features list: @ai-docs/FEATURES.md

**File Structure:**
- Input: `./ai-docs/features/[feature]/` (expects spec.md, ux.md, and ui.md)
- Output: 
  - `./ai-docs/features/[feature]/plan.md` (implementation strategy)
  - `./ai-docs/features/[feature]/research.md` (technical research and decisions)
  - `./ai-docs/features/[feature]/data-model.md` (entities)
  - `./ai-docs/features/[feature]/setup.md` (environment setup and configuration)
  - `./ai-docs/features/[feature]/contracts/` (API contracts)

# Task

Transform validated feature specifications into focused technical implementation plan.
Fill plan-template.md with concrete technical decisions while generating MINIMAL supporting artifacts.

# Core Principles

## File Ownership
- **research.md**: WHY decisions were made (including any necessary deviations from PRD approach)
- **data-model.md**: ALL entities, states, validation rules, constants (timeouts, limits, enums)
- **contracts/**: HOW components communicate (transport schemas ONLY)
- **setup.md**: HOW TO install and run
- **plan.md**: HOW TO organize and implement

## Content Guidelines
- Maximum 300 lines per file
- No implementation code, only architecture
- Reference using comments at first mention only: `// from data-model.md`
- Remove all future scope markers and unused fields
- Each word must add value - no boilerplate

## Consistency Rules
- Validation phrasing must match spec.md exactly
- Derived values as formulas: `// base_timeout + increment`
- Constants only in data-model.md
- One code organization structure in plan.md
- When first referencing entity/state types in each contract: add origin comment
- Subsequent references in same contract don't need comments

## Planning Coverage Rules
- All functional requirements from spec.md must have implementation approach
- All UX patterns from ux.md must map to technical components
- All UI components from ui.md must map to code organization
- Reference existing documentation instead of duplicating
- Reference existing code modules instead of proposing duplicates

**Technical Context filling:**
- Must align with PRD Technical Requirements section where applicable
- If feature requires deviation from PRD stack, briefly note: "[Component]: [Choice] - [One sentence rationale]"
- Rationale must be feature-specific, not technology-specific

## API Specification Rules
- Use OpenAPI 3.1.0+ for REST API specifications
- Follow latest specification standards for all contract types
- Keep contracts focused on interfaces, not implementation

# Execution Flow

## Phase 0: Context & Research

### 0.1 Initialize Planning
```bash
# Validate required inputs exist
[ ! -f "./ai-docs/features/$FEATURE/spec.md" ] && echo "Error: spec.md not found" && exit 1
[ ! -f "./ai-docs/features/$FEATURE/ux.md" ] && echo "Error: ux.md not found" && exit 1
[ ! -f "./ai-docs/features/$FEATURE/ui.md" ] && echo "Error: ui.md not found" && exit 1
```

**Load ALL source files once:**
- Read `./ai-docs/features/[feature]/spec.md` → Extract requirements, entities (note existing Key Entities section)
- Read `./ai-docs/features/[feature]/ux.md` → Extract flows, patterns, quantified UX values for constants
- Read `./ai-docs/features/[feature]/ui.md` → Extract component trees, DS mapping, layout structure, visual state mapping
- Read `./ai-docs/PRD.md` → Extract technical requirements and architecture
- Read `./ai-docs/FEATURES.md` → Understand feature context and dependencies

**Cross-Feature Entity References:**
- Extract dependency list from FEATURES.md "Depends on:" field (already loaded in context)
- For each dependency folder:
  - Check if ./ai-docs/features/[dependency]/data-model.md exists
  - If exists: reference by path, do not redefine entities
  - If not exists: define minimal interface with required fields and [Dependency] marker
  - [Dependency] marker signals: "Full definition in dependent feature, this is contract only"

**Keep in context throughout execution**

### 0.2 Scan Existing Codebase

**Apply Code Analyzer skill** to extract (if source code exists):
- Module structure (directories, existing components)
- Entry points and routing
- Shared modules and utilities
- Existing patterns (state management, API layer, styling approach)
- AICODE-NOTE markers (developer context)

If no source code found → skip, proceed to 0.3.

**Use codebase context in Phase 2:**
- Reuse existing shared modules instead of creating duplicates
- Follow established patterns (file naming, component structure, state management)
- Place new code in locations consistent with existing organization
- Reference existing utilities in plan.md instead of proposing new ones

### 0.3 Load References
```bash
# Load supplementary materials if available
if [ -d "./ai-docs/references" ]; then
    echo "Loading references..."
    find ./ai-docs/references -type f 2>/dev/null
fi
```
- If references directory contains files: Read all files into context
- Relevant reference types for implementation planning:
  - **Data schemas** (.json, .yaml) → ready field types, relationships for data-model.md
  - **API contracts** (.json, .yaml) → base for contracts/ generation (endpoints, payloads)
  - **Architecture notes** (.md) → infrastructure constraints, key decisions for research.md
  - **Design system** (.md) → component architecture, import patterns for plan.md Technical Context
  - **Style guide** (.md) → styling approach for plan.md Technical Context
  - **Design tokens** (.json, .css) → token import strategy for setup.md
- Keep in context throughout planning
- If directory empty or doesn't exist: skip silently, proceed without references

### 0.4 Execute Research & Document

**Extract dependencies from spec.md, ux.md, and ui.md:**
- Identify mentioned libraries, frameworks, packages
- Note technology stack references
- Include DS library from ui.md header
- Verify alignment with PRD architecture choices

**Apply System Design Decision Tree skill** for architectural trade-offs:

1. Build context object for the skill:
   - Functional scope from spec.md (FR-XXX, UX-XXX, Key Entities)
   - Technical requirements from PRD.md (Technical Context, constraints)
   - User flows and quantified values from ux.md

2. Triage — skill classifies the feature into applicable categories (Simple CRUD, data-heavy, real-time, offline-critical, media-heavy, integration-heavy, frequent UI iteration). Multi-category is the norm.

3. Skill loads matched references and returns a question bank: 2–8 multiple-choice questions with one recommended default per question, ordered by decision dependency (scale → offline → latency → specific trade-offs).

4. Present questions to the user interactively, one stage at a time. For each:
   - Show all options with the recommended option marked
   - Show red-flag warnings when the skill flags the combination (e.g., Offline: Full + Consistency: Strong)
   - Wait for user selection or custom override
   - Do not auto-accept defaults — every decision must be explicitly confirmed

5. Every question must be answered before proceeding. No unresolved ambiguity goes into research.md.

6. Skill synthesizes final output:
   - **Architectural Decisions** with rejected alternatives (→ research.md Key Decisions)
   - **Required Behaviors** with verification methods (→ research.md Non-Functional Requirements)

**Apply Sequential Thinking Methodology** for research analysis:
- Analyze feature dependencies from extracted libraries
- Evaluate compatibility with PRD stack
- Identify integration risks
- Select optimal versions
- Document critical decisions

**Apply Context7 Documentation Retrieval** for each identified library:
- Resolve library ID (trust score ≥7 preferred)
- Fetch documentation with feature-specific topic
- Use 20000 tokens for comprehensive coverage

If no external libraries identified, skip library documentation step.

**Create concise research.md:**
```markdown
# Research Notes - [Feature Name]

## Key Decisions (essential points only, typically 3-7)
- **[Decision]**: [What chosen] — [Brief why, 1 sentence]. Rejected: [alternative + reason] (for architectural trade-offs from System Design skill)

## Non-Functional Requirements
[Optional section — include only if System Design skill returned Required Behaviors]
- [Testable behavior with verification method]

## Critical Risks
- **[Risk]**: [Impact] → [Mitigation]

## Stack Compatibility
- [Verified combination]: ✔
```

**Enrich from References (if loaded):**
- Architecture notes → incorporate infrastructure decisions and constraints into Key Decisions
- If architecture notes contradict PRD → note deviation with rationale in Key Decisions

NO alternatives, NO lengthy explanations, NO rejected approaches outside of architectural trade-offs.
NO configuration details (those go in `setup.md`).
NO implementation details (those go in `plan.md`).

**Write research artifact:**
- Write `./ai-docs/features/[feature]/research.md`

## Phase 1: Design Artifacts

### 1.1 Generate Data Model
**Analyze entities from spec.md (already in context):**
- Extract directly from Key Entities section
- Define field types and constraints based on requirements
- Map relationships and cardinality
- Identify state transitions from ux.md flows
- Extract validation rules from spec.md requirements
- Extract quantified values from ux.md Quantified UX Elements for constants

**Enrich from References (if loaded):**
- Data schemas → use concrete field names, types, and relationships instead of inferring from spec.md
- API contracts → extract request/response field types that become entity fields
- Data schemas take precedence for field definitions; spec.md takes precedence for validation rules

**Type Completeness Rule:**
- Every type referenced in entity fields MUST be defined in data-model.md
- If field type is complex (not primitive), define as separate entity or type alias
- Primitives: string, number, boolean, timestamp, array of primitives
- Referenced but undefined types block downstream generation

**Create data-model.md with technical specs:**
```markdown
# Data Model - [Feature Name]

## Entities
[For each entity from spec.md add:
- Field types and constraints (required/optional, length limits)
- System fields (unique identifier, timestamps)
- Default values and computed fields]

## Enums
[All enumerated types used in entities:
- Enum name with values
- Brief description of each value if not self-evident]

## States & Transitions
[State machine if applicable:
- State diagram or transition table
- Triggers, conditions, side effects
- Timeouts if any]

## Constants
[All numeric values: timeouts, limits, thresholds
- Include values from ux.md Quantified UX Elements
- Use formulas for derived values: // BASE_TIMEOUT + INCREMENT
- For thresholds: specify comparison operator in description (< or <=, > or >=)
- Reference source: (FR-XXX), (UX-XXX), (ux.md), (PRD constraint)]

## Validation Rules
[Field-level and entity-level validations:
- Format patterns, length limits, ranges
- Cross-field validations
- Business rule validations]
```

NO code, NO SQL, NO platform-specific types.
Abstract technical specifications that apply to any implementation.

**Write data model artifact:**
- Write `./ai-docs/features/[feature]/data-model.md`

### 1.2 Generate API Contracts (if needed)
**Create contracts based on feature interfaces:**

**Enrich from References (if loaded):**
- API contracts from references → use as base structure for openapi.yaml (endpoints, methods, payload shapes)
- Data schemas → cross-check entity field names match between data-model.md and contracts
- Do not blindly copy reference contracts — adapt to feature scope, remove irrelevant endpoints

Create `./ai-docs/features/[feature]/contracts/`:
- Write `./ai-docs/features/[feature]/contracts/openapi.yaml` - For REST API endpoints
- Write `./ai-docs/features/[feature]/contracts/contracts.md` - For messaging, events, WebSocket, storage schemas

Feature may require BOTH files if it uses multiple interface types

**Content guidelines:**
- Message/event contracts: type names and message structure only
- Storage contracts: reference to entity type, not field expansion
- API contracts: field names, primitive types, and structural constraints
  - Structural constraints (INCLUDE): required fields, enum values, array minItems/maxItems
  - Validation constraints (EXCLUDE): string length, numeric ranges, regex patterns — those belong in data-model.md
- First reference to entity/state types: add origin comment
- Subsequent references in same contract: no comment needed

**Contract type determination:**
- External communication interfaces → formal specification required
- Internal messaging between components → message schema documentation
- Event-based communication → event structure documentation
- If no external interfaces exist → skip formal specification creation

### 1.3 Create Setup Guide
**Generate setup.md:**
```markdown
# Setup - [Feature Name]

## Install
[Installation commands for dependencies]

## Config
[Key configuration needed for this feature]

## Run
[Commands to start development]

## Test
[Commands to run automated tests for TDD workflow]
```

**Enrich from References (if loaded):**
- Architecture notes → specific config requirements (env vars, service connections)
- Design tokens → token import/build commands if token pipeline needed

Brief setup instructions only - TDD test commands, no lengthy configs.
NO architecture explanations (those are in plan.md).
NO justifications for dependencies (those are in research.md).

**Write setup artifact:**
- Write `./ai-docs/features/[feature]/setup.md`

## Phase 2: Implementation Plan

**Use already generated artifacts from context:**
- Continue with research.md, data-model.md, setup.md, contracts/ in memory
- No re-reading needed as content is already in context

**Apply Sequential Thinking Methodology** for planning synthesis:
- Synthesize sources (PRD, spec, ux, ui, FEATURES)
- Integrate research decisions from research.md (Key Decisions + Non-Functional Requirements)
- Incorporate entity model from data-model.md
- Incorporate component structure from ui.md (component trees, DS mapping)
- Include setup from setup.md and contracts from contracts/
- If codebase exists: account for existing modules, patterns, and shared utilities (from Phase 0.2)
- If references loaded: account for design system architecture, styling approach, token strategy
- Map to plan-template sections
- Select optimal code organization
- Define component architecture

### Fill Template Sections

**Consistency validation before writing:**
- Cross-check validation rules against spec.md exact phrasing
- Verify all FR-XXX requirements have implementation approach
- Ensure all UX-XXX requirements map to components
- Ensure all ui.md components have code locations in code organization
- Ensure all ui.md slot=true components have children/slot API in code organization
- Check entity naming consistency across all artifacts
- Verify storage approach aligns with spec.md requirements AND architectural decisions from research.md
- Ensure no constants are hardcoded (reference data-model.md)
- Check derived values use formula comments
- Verify all referenced types are defined in data-model.md
- If codebase exists: verify code organization matches existing patterns (from Phase 0.2)

**Purpose & Summary:**
- 1-2 sentences max each
- Reference research.md for details

**Technical Context:**
- Brief bullets only
- State what is used, not why (why is in research.md)
- Reference specific technology decisions from research.md
- If design system reference loaded: include DS import approach and token strategy
- If style guide reference loaded: include styling approach
- **Storage:** Specify primary storage + any secondary storage with clear use case separation
  - Example: "PostgreSQL for entities, Redis for cache, IndexedDB for offline support"
- **Constraints:** Include NFR constraints from research.md Non-Functional Requirements (if present)

**Implementation Mapping:**
- How requirements → components (don't repeat requirements)
- How ui.md component trees → code files (don't repeat component catalog)
- How errors → handling (don't repeat error types)
- How ui.md slot markers → component API (slot: true → children prop or render-prop)
- Component names should reflect feature purpose

**Testing Approach:**
- Test-first development workflow
- Unit test structure matching code organization
- Integration test scenarios from acceptance criteria
- Non-functional requirements from research.md become verification tests
- NO manual test checklists

**Select Feature Code Organization:**
- If codebase exists: prefer structure consistent with existing code organization (from Phase 0.2)
- If greenfield: choose ONE structure (A, B, C, or D) from template
- Remove all other structures and their "Structure X:" prefixes
- Keep only selected structure with its rationale
- Document brief rationale for selection
- Code organization must accommodate ui.md component tree depth and nesting
- **Selected Structure:** [Structure letter] ([Structure name]) - [One sentence rationale specific to this feature's requirements]
  - Rationale must reference specific requirements, not generic benefits

**Implementation Notes:**
- Document critical implementation decisions, trade-offs, or considerations
- Include architectural trade-offs from research.md Key Decisions (e.g., cursor pagination vs offset, SSE vs WebSocket)
- If codebase exists: note which existing modules to reuse and which new ones to create
- **Edge case handling:** Document approach for spec.md edge cases. If not all covered, note which require future iteration with rationale
- **Scalability notes:** If feature may hit limits (data size, API rate, etc.), document threshold and mitigation strategy

**Write plan.md:**
- Write `./ai-docs/features/[feature]/plan.md`
- Exclude Review Checklist from output

## Phase 3: Validate & Report

Internal validation using template's Review Checklist (mental check only):
- Requirements coverage
- No duplication
- Consistency across files
- Single code organization selected
- All referenced types defined in data-model.md
- All thresholds have comparison operators specified
- All constants from ux.md Quantified UX Elements included
- All ui.md components have code locations in plan.md
- Cross-feature dependencies properly handled
- All architectural decisions from System Design skill have rejected alternatives noted

**Final output:**
```
Implementation Planning Complete!

Feature: [feature-name]
Generated:
- plan.md (implementation strategy)
- research.md (key decisions)
- data-model.md (entities)
- setup.md (setup commands)
- contracts/ (if API needed)

Next: /docs:tasks <feature-path>
```

# Error Handling

- **Missing files**: "Error: [file] not found. Run [command] first."
- **Size exceeded**: "Error: [file] exceeds 300 lines."
- **Duplication detected**: "Warning: Content duplicates [source]. Reference instead."
- **Validation mismatch**: "Error: Validation for [field] differs from spec.md requirements."
- **Missing implementation**: "Error: [requirement] from spec.md not addressed in plan."
- **UX pattern unmapped**: "Error: [pattern] from ux.md not mapped to components."
- **UI component unmapped**: "Error: [component] from ui.md not mapped to code organization."
- **Constant duplication**: "Error: [value] defined in multiple files. Use data-model.md as single source."
- **Undefined type**: "Error: Type [name] referenced in [entity] but not defined in data-model.md."
- **Missing comparison operator**: "Error: Threshold [name] missing comparison operator (< or <=) in description."
- **Missing dependency definition**: "Error: Entity from [feature-name] referenced but dependency data-model.md not found and no [Dependency] interface defined."
- **Missing quantified value**: "Warning: Quantified UX Element [name] from ux.md not included in data-model.md Constants."
- **Reference-spec conflict**: "Warning: Reference [file] conflicts with spec.md on [topic]. Spec.md takes priority."
- **System Design unresolved questions**: "Error: Architectural decisions cannot be committed with unresolved questions. Remaining: [list]. Answer all questions before proceeding."
- **System Design missing rejected alternative**: "Error: Architectural decision [topic] in research.md missing rejected alternative. Every trade-off must name what was rejected and why."