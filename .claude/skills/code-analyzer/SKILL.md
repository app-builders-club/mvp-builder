---
name: code-analyzer
description: "Comprehensive codebase analysis for building mental model of project structure, dependencies, and implementation context. Use when needing to: (1) Understand project architecture before review or documentation, (2) Find dependencies and shared modules, (3) Trace execution paths and abstraction layers for similar features, (4) Locate implementation markers (AICODE-*), (5) Prepare context for review, memory generation, or agent creation. Triggers on: analyze code, load code context, scan codebase, understand project structure, trace feature."
allowed-tools: Read, Bash (*)
---

# Code Analyzer

Analyze codebase to build comprehensive mental model for downstream operations.

## Workflow Overview

1. **Scan** — Collect facts via bash script (deterministic)
2. **Understand** — Interpret structure and stack
3. **Trace** — Follow execution paths through abstraction layers (skip if greenfield)
4. **Build** — Construct dependency graph and mental model
5. **Confirm** — Output summary with key files list

## Step 1: Scan Project

Run codebase scanner to collect facts:

```bash
.claude/skills/code-analyzer/scripts/scan-codebase.sh
```

Scanner auto-detects project root (git root or pwd) and collects:
- Structure: file count, extensions, configs, directories, src modules
- Markers: AICODE-NOTE, AICODE-TODO, AICODE-FIX with locations
- Git: branch, modified/added/deleted files

Outputs JSON. No external dependencies required.

### Exclusions (automatic)
- node_modules, .git, dist, build
- __pycache__, .venv, venv
- ai-docs, .next, .nuxt, coverage, .cache

## Step 2: Understand Structure

Interpret scan results to determine:
- **Stack**: Language(s) from extensions, framework from configs
- **Entry points**: Main/index/app files in directories
- **Modules**: Domain boundaries from src_modules or directories
- **Conventions**: Naming patterns, structure style

## Step 3: Trace Patterns

**Skip if greenfield project (no src files found in Step 1).**

For existing codebases, trace how code actually works — not just what files exist:

**3.1 Find similar features**
- Grep for features with similar domain (e.g., if building "payments", find existing "orders" or "billing")
- Identify entry points: API routes, UI components, CLI commands

**3.2 Trace execution paths**
- Follow call chain from entry point through business logic to data layer
- Note data transformations at each hop with file:line references
- Document side effects and state changes encountered

**3.3 Map abstraction layers**
- Identify boundaries: presentation → business logic → data access
- Note which patterns are in use (repository, service layer, controller, middleware, etc.)
- Document cross-cutting concerns encountered (auth, logging, caching, error handling)

**3.4 Identify reuse opportunities**
- Shared utilities and helpers with 3+ consumers
- Existing patterns that new code should follow
- Modules that new feature should integrate with (not duplicate)

## Step 4: Build Mental Model

Extract and internalize from scan results + tracing:

**From structure:**
- Stack: `[language] | [framework] | [build-tool]`
- Entry points with types
- Module list with inferred domains
- Directory organization

**From tracing (if performed):**
- Abstraction layers: `[presentation] → [business] → [data]`
- Design patterns in use with file:line examples
- Cross-cutting concerns and how they're implemented
- Reusable modules for new feature integration

**From markers:**
- AICODE-NOTE → Implementation context (why decisions were made)
- AICODE-TODO → Planned work (incomplete areas)
- AICODE-FIX → Known issues (from previous reviews)

**From git:**
- Current branch → feature context
- Changed files → review/focus scope

**From reading key files:**
- Import patterns → dependency relationships
- Shared modules → components with 3+ incoming connections
- Circular dependencies → architectural issues

## Step 5: Confirm Readiness

Output minimal confirmation with key files list:
```
✅ Code context loaded: [project-name]
   Stack: [language] | [framework]
   Modules: [count] ([list])
   Patterns: [list of design patterns found, if traced]
   Markers: [N] NOTE, [N] TODO, [N] FIX

   Key files (read these for deep context):
   - [path] — [why this file matters]
   - [path] — [why this file matters]
   - ... (5-10 files max)

   Ready for: review | planning | documentation | agent-generation
```

**Key files list** — the 5-10 most important files for understanding the area being worked on. Calling agents/commands should read these files after Code Analyzer completes rather than re-scanning independently.

## Error Handling

- **Empty project**: Report "No source files found"
- **No git repo**: Continue without git section (is_repo: false)
- **Permission denied**: Report file, continue with available
- **No similar features found**: Skip tracing, note "greenfield area — no existing patterns to follow"

## Usage Notes

This skill prepares context for:
- Code review (scope, markers, dependencies)
- Implementation planning (patterns, reuse, architecture)
- Documentation generation (structure, stack)
- Agent creation (domains, boundaries)

Context remains in memory for entire conversation.