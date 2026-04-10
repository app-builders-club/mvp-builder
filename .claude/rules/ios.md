# iOS / Swift Development Standards

Platform-agnostic decisions, constraints, and non-negotiable rules for iOS/macOS/multiplatform Swift projects.

## Swift Concurrency

### Before Any Fix

1. Check `Package.swift` or `.pbxproj` for: language mode (Swift 5 vs 6), strict concurrency level, default isolation, upcoming features (`NonisolatedNonsendingByDefault`).
2. If any setting is unknown — ask before giving migration-sensitive guidance. Do not guess.

### Non-Negotiable Rules

- Never recommend `@MainActor` as a blanket fix. Justify why the code is truly UI-bound.
- Prefer structured concurrency (`async let`, `TaskGroup`) over unstructured `Task { }`. Use `Task.detached` only with a documented reason.
- If recommending `@preconcurrency`, `@unchecked Sendable`, or `nonisolated(unsafe)` — require a documented safety invariant and a follow-up removal plan.
- Optimize for the smallest safe change. Do not refactor unrelated architecture during migration.
- Never add fake `await` (e.g. `Task.yield()`) to silence `async_without_await` lint. Remove `async` or suppress narrowly.
- After 3 failed fix attempts — stop and question the architecture.

### Tool Selection

| Need | Tool |
|------|------|
| Single async operation | `async/await` |
| Fixed parallel operations | `async let` |
| Dynamic parallel operations | `withTaskGroup` |
| Sync → async bridge | `Task { }` (inherits actor context) |
| Shared mutable state | `actor` |
| UI-bound state | `@MainActor` (only for truly UI-related code) |
| Synchronous locking (iOS 18+) | `Mutex` |

### Swift 6 Migration

- Migrate incrementally: one module/file at a time, one error category at a time.
- Sequence: Minimal → Targeted → Complete strict concurrency checking.
- Build → Fix → Rebuild → Test loop. Never batch unrelated fixes.
- Make new types `Sendable` from the start.
- Enable upcoming features individually before Approachable Concurrency bundle.

### Memory Management

- Default to `[weak self]` for long-running or infinite tasks.
- Strong capture OK only for short-lived tasks that complete quickly.
- Infinite `AsyncSequence` loops with strong `self` capture keep the object alive forever.
- `isolated deinit` runs cleanup but won't break retain cycles (deinit never called if cycle exists).
- `try?` in loops with `Task.sleep` can swallow `CancellationError` — check `Task.isCancelled` explicitly.

### Testing Concurrency

- Prefer Swift Testing over XCTest for new tests.
- Use `withMainSerialExecutor` + `Task.yield()` for deterministic intermediate-state assertions.
- `withMainSerialExecutor` does not work with parallel test execution — mark suite `.serialized`.
- Replace `wait(for:)` with `await fulfillment(of:)` to avoid deadlocks.

---

## SwiftUI

### Correctness Checklist (violations are always bugs)

- `@State` properties are `private`.
- `@Binding` only where a child modifies parent state.
- Passed values never declared as `@State` or `@StateObject` (they ignore updates).
- `@StateObject` for view-owned objects; `@ObservedObject` for injected (pre-iOS 17).
- iOS 17+: `@State` with `@Observable`; `@Bindable` for injected observables needing bindings.
- `@Observable` classes marked `@MainActor` (unless default actor isolation is MainActor).
- `@ObservationIgnored` on all property wrappers (`@AppStorage`, `@SceneStorage`, `@Query`) inside `@Observable` classes.
- `ForEach` uses stable identity (never `.indices` for dynamic content).
- Constant number of views per `ForEach` element.
- `.animation(_:value:)` always includes the `value` parameter.
- `@FocusState` properties are `private`.
- iOS 26+ APIs gated with `#available` and fallback provided.
- `import Charts` present in files using chart types.

### Property Wrapper Selection (iOS 17+)

| Wrapper | Use When |
|---------|----------|
| `@State private var` | View-owned state (value types or `@Observable` classes) |
| `@Binding var` | Child modifies parent state |
| `@Bindable var` | Injected `@Observable` object needing bindings |
| `let` | Read-only value from parent |
| `var` | Read-only value reacting via `.onChange()` |

### Deprecated API Rules

Always use modern equivalents:
- `navigationTitle` not `navigationBarTitle`
- `toolbar { ToolbarItem }` not `navigationBarItems`
- `foregroundStyle` not `foregroundColor`
- `clipShape(.rect(cornerRadius:))` not `cornerRadius()`
- `confirmationDialog` not `actionSheet`
- `alert(_:isPresented:actions:message:)` not `alert(isPresented:content:)`
- `animation(_:value:)` not `animation(_:)` without value
- `NavigationStack` not `NavigationView` (iOS 16+)
- `@Observable` not `ObservableObject` (iOS 17+)
- `onChange(of:) { old, new in }` not `onChange(of:perform:)` (iOS 17+)
- `sensoryFeedback(_:trigger:)` not UIKit feedback generators (iOS 17+)
- `Tab` API not `tabItem(_:)` (iOS 18+)

### View Composition

- Prefer modifiers over conditional views for state changes (e.g. `.opacity` not `if`/`else`).
- Extract complex views into separate `struct` subviews — `@ViewBuilder` functions re-execute on every parent state change.
- Container views use `@ViewBuilder let content: Content`, not closure.
- Use `overlay`/`background` for decoration; `ZStack` for peer composition.
- `.compositingGroup()` before `.clipShape()` on layered views to avoid antialiasing fringes.

### Performance Rules

- No object creation in `body` (formatters, etc. — use `static let`).
- No heavy computation in `body` (sorting, filtering — move to model or `.onChange`).
- Derived state computed, not stored separately.
- Pass only needed values to views, not entire config objects.
- `Self._logChanges()` (iOS 17+) to debug unexpected view updates.
- `LazyVStack`/`LazyHStack` for large collections.
- Gate frequent scroll position updates by thresholds, not on every pixel.
- Sendable closures (`Shape.path`, `visualEffect`, `Layout`) capture values via capture list instead of accessing `@MainActor` state directly.

### Sheets & Navigation

- `.sheet(item:)` over `.sheet(isPresented:)` for model-based content.
- Sheets own their actions and dismiss internally via `@Environment(\.dismiss)`.
- Enum-based `Identifiable` type with `.sheet(item:)` for multiple sheet types.
- `NavigationStack` with `navigationDestination(for:)` for type-safe navigation.
- `NavigationSplitView` for sidebar-driven multi-column layouts.

### Accessibility

- `Button` for all tappable elements (not `onTapGesture`).
- Built-in text styles or Dynamic Type-aware custom fonts.
- `@ScaledMetric` for custom spacing/sizing values.
- Decorative images: `Image(decorative:)` or `.accessibilityHidden(true)`.
- Group related elements with `accessibilityElement(children:)`.

### Liquid Glass (iOS 26+)

- Only adopt when explicitly requested.
- `GlassEffectContainer` wraps grouped glass elements.
- `.glassEffect()` applied after layout modifiers.
- `.interactive()` only on user-interactable elements.
- Always `#available(iOS 26, *)` with material-based fallback.

---

## Core Data

### Golden Rule

Never pass `NSManagedObject` between contexts or threads. Always use `NSManagedObjectID`.

### Stack Setup

- `viewContext.mergePolicy = NSMergeByPropertyStoreTrumpMergePolicy` — required for constraints.
- `viewContext.automaticallyMergesChangesFromParent = true` on all contexts.
- Name contexts and set `transactionAuthor` for debugging and persistent history filtering.
- Enable persistent history tracking + remote change notifications if using batch operations or app extensions.

### Context Rules

- View context (main queue) for UI operations only. Keep lightweight.
- Background context (private queue) for imports, exports, batch operations.
- Always wrap work in `perform { }` or `performAndWait`. Never access context directly from another queue.
- Prefer `perform` (async) over `performAndWait` (blocks calling thread).

### Saving

- Use `hasPersistentChanges` check before saving — not bare `save()`.
- Save at lifecycle events (background, terminate), after user actions, periodically during long imports.
- Never save inside loops. Batch saves every 100 objects + `context.reset()` to free memory.
- Never call `save()` inside `willSave()` — infinite loop.

### Batch Operations

- Use `NSBatchInsertRequest` / `NSBatchDeleteRequest` / `NSBatchUpdateRequest` for large datasets (10-20x faster).
- Batch operations bypass object graph: no validation, no lifecycle events, no change notifications.
- Persistent history tracking is required for batch operations to update UI.
- Cannot set relationships in batch insert — set them separately after.
- Always execute on background context.

### Swift Concurrency + Core Data

- `NSManagedObject` cannot be `Sendable`. Never use `@unchecked Sendable` on it.
- Pass `NSManagedObjectID` (which is Sendable) between tasks/actors.
- `@MainActor` for view context operations. Background contexts via `context.perform { }`.
- If default isolation is `@MainActor`, set entity code generation to Manual and mark classes `nonisolated`.
- Prefer simple `CoreDataStore` pattern with `@MainActor` read + background perform over custom actor executors.

### Migration

- Lightweight migration handles most changes and is enabled by default with `NSPersistentContainer`.
- Renaming: set renaming identifier to the old name.
- Staged migration (iOS 17+) for changes exceeding lightweight capabilities.
- Deferred migration (iOS 14+) for expensive cleanup — finish via `BGProcessingTask`.

### Debugging

- `-com.apple.CoreData.ConcurrencyDebug 1` — catches threading violations.
- `-com.apple.CoreData.SQLDebug 1` — logs SQL queries.
- `-com.apple.CoreData.MigrationDebug 1` — logs migration steps.

---

## Swift Testing

### Framework Choice

- Swift Testing for unit and integration tests.
- XCTest for: UI automation (`XCUIApplication`), performance metrics (`XCTMetric`), Objective-C tests.
- Both can coexist in the same target during migration.

### Assertions

- `#expect` as default assertion. Natural Swift expressions (`==`, `>`, `.contains`).
- `#require` when subsequent lines depend on a prerequisite value (guard + fail early).
- `withKnownIssue` for temporary expected failures — prefer over blanket disabling.
- `Issue.record("...")` replaces `XCTFail("...")`.

### Parameterized Tests

- Replace duplicate test methods with `@Test(arguments:)`.
- Use concrete literal expectations, not values derived from the input itself.
- No `if`/`switch` branching inside parameterized test bodies — split into separate tests.
- Paired inputs: array of tuples or dictionary, not `zip(allCases, allCases)`.
- `CaseIterable.allCases` only for property-based tests, not example-based mappings.

### Parallelization

- Tests run in parallel by default with randomized order.
- Fix shared-state coupling before adding `.serialized`.
- `.serialized` is a transitional tool, not default architecture.
- Use in-memory fakes for the fast path.

### Organization

- `@Test` on function (global or method). `@Suite` for grouping with traits.
- Prefer `struct` suites for value semantics.
- `@available` on test functions, never on suite types.
- Tags for cross-suite grouping and test-plan filtering. Keep naming stable.
- `import Testing` only in test targets.

### Migration from XCTest

Order: assertions → `@Test` declarations → suite organization → parameterization → traits/tags.

| XCTest | Swift Testing |
|--------|---------------|
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTAssertNil(x)` | `#expect(x == nil)` |
| `XCTAssertThrowsError(try f())` | `#expect(throws: (any Error).self) { try f() }` |
| `try XCTUnwrap(x)` | `let x = try #require(x)` |
| `XCTFail("msg")` | `Issue.record("msg")` |
| `XCTestExpectation` + `wait` | `confirmation` or direct `await` |

---

## Verification Order

For all code changes: **build → types → lint → tests**