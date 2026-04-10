# Code Quality Standards

Cross-platform standards. Platform rules (ios.md, frontend.md, backend.md) take precedence for platform-specific concerns.

## Error Handling

### Non-negotiable
- Empty catch blocks are forbidden — always log or rethrow
- Never silently return null/undefined/default on error without logging
- Catch blocks must be specific to expected error types — broad catches hide unrelated errors
- Every user-facing error must be actionable: what went wrong + what to do
- Fallback behavior must be explicit and justified — never mask the real problem
- Mock/fake implementations belong only in tests, never as production fallbacks

### Error Messages
- Non-technical language for users, technical details for developers
- Include relevant context (operation name, file, IDs)
- Specific enough to distinguish from similar errors

## Code Simplification

### Principles
- Clarity over brevity — explicit code > clever one-liners
- No nested ternaries — use switch/if-else for multiple conditions
- Reduce nesting and unnecessary abstraction
- Eliminate redundant code, consolidate related logic
- Remove comments that describe obvious code
- Preserve all functionality — only change how, never what

### Balance
- Don't over-simplify: don't combine too many concerns into one function
- Don't remove helpful abstractions that improve organization
- Don't optimize for "fewer lines" at the cost of readability

## Comments

### When Comments Add Value
- Explaining "why" (business logic rationale, non-obvious decisions)
- Critical assumptions and preconditions
- Non-obvious side effects
- Complex algorithm approach explanation

### When to Remove
- Restating what the code obviously does
- Referencing temporary/transitional states
- TODOs/FIXMEs that have been addressed
- Outdated references to refactored code

### Comment Quality Check
- Every claim must match actual code (signatures, behavior, types)
- Edge cases mentioned must actually be handled
- Examples must match current implementation

## Type Design

### Principles
- Make illegal states unrepresentable
- Validate invariants at construction time
- Prefer compile-time guarantees over runtime checks
- Immutability simplifies invariant maintenance
- Constructor validation is crucial

### Anti-patterns
- Anemic domain models with no behavior
- Types exposing mutable internals
- Invariants enforced only through documentation
- External code responsible for maintaining type invariants
- Missing validation at construction boundaries