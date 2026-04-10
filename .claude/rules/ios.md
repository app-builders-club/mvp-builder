# iOS / Swift Development Standards

Decisions, constraints, and non-negotiable rules for iOS/macOS/multiplatform Swift projects.

## Swift Code Style

- Prefer `if let value {` shorthand over `if let value = value {`.
- Omit `return` for single-expression functions. Use `if`/`switch` as expressions when returning or assigning.
- Prefer Swift-native string methods: `replacing("a", with: "b")` not `replacingOccurrences(of:with:)`.
- Prefer modern Foundation: `URL.documentsDirectory` over `FileManager` lookups, `appending(path:)` for URL strings.
- Never use C-style `String(format: "%.2f", value)`. Use `FormatStyle` APIs or `Text(value, format:)`.
- Prefer static member lookup: `.circle` not `Circle()`, `.borderedProminent` not `BorderedProminentButtonStyle()`.
- Avoid force unwraps (`!`) and force `try`. Use `if let`, `guard let`, nil-coalescing, or `do-catch`.
- `count(where:)` not `filter().count`.
- `Date.now` not `Date()`.
- `localizedStandardContains()` for user-input text filtering.
- Prefer `Double` over `CGFloat` except with optionals or `inout`.
- Use `PersonNameComponents` with modern formatting for people's names.
- Prefer modern `Date(myString, strategy: .iso8601)` over manual date formatting. For display use `"y"` not `"yyyy"` for years.
- Flag silently swallowed errors from user actions — show alerts, not `print(error)`.
- If a type is repeatedly sorted by the same closure, conform it to `Comparable`.

---

## Swift Concurrency

### Before Any Fix

1. Check `Package.swift` or `.pbxproj` for: language mode (Swift 5 vs 6), strict concurrency level, default isolation, upcoming features (`NonisolatedNonsendingByDefault`).
2. If any setting is unknown — ask before giving migration-sensitive guidance. Do not guess.

### Non-Negotiable Rules

- Never use GCD (`DispatchQueue.main.async`, `DispatchQueue.global`, etc.). Always modern Swift concurrency.
- Never use `Task.sleep(nanoseconds:)` — use `Task.sleep(for:)`.
- Never recommend `@MainActor` as a blanket fix. Justify why the code is truly UI-bound.
- When evaluating `MainActor.run()`, check if default isolation is MainActor first — it may not be needed.
- Prefer structured concurrency (`async let`, `TaskGroup`) over unstructured `Task { }`. Use `Task.detached` only with a documented reason.
- If recommending `@preconcurrency`, `@unchecked Sendable`, or `nonisolated(unsafe)` — require a documented safety invariant and a follow-up removal plan.
- Optimize for the smallest safe change. Do not refactor unrelated architecture during migration.
- Never add fake `await` (e.g. `Task.yield()`) to silence `async_without_await` lint. Remove `async` or suppress narrowly.
- Flag mutable shared state not protected by an actor or `@MainActor` (unless default isolation is MainActor).
- If an API offers both `async/await` and closure-based variants, always use `async/await`.
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
- Never use `@AppStorage` inside `@Observable` even with `@ObservationIgnored` — it won't trigger view updates. Use `@AppStorage` directly in views.
- `@AppStorage` must never store passwords, usernames, or sensitive data — use Keychain.
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

Strongly avoid `ObservableObject`, `@Published`, `@StateObject`, `@ObservedObject`, `@EnvironmentObject` unless unavoidable or legacy.

### Deprecated API Rules

Always use modern equivalents:
- `navigationTitle` not `navigationBarTitle`
- `toolbar { ToolbarItem }` not `navigationBarItems`
- `.topBarLeading`/`.topBarTrailing` not `.navigationBarLeading`/`.navigationBarTrailing`
- `foregroundStyle` not `foregroundColor`
- `clipShape(.rect(cornerRadius:))` not `cornerRadius()`
- `overlay(alignment:content:)` not `overlay(_:alignment:)`
- `confirmationDialog` not `actionSheet`
- `alert(_:isPresented:actions:message:)` not `alert(isPresented:content:)`
- `animation(_:value:)` not `animation(_:)` without value
- `NavigationStack` not `NavigationView` (iOS 16+)
- `@Observable` not `ObservableObject` (iOS 17+)
- `onChange(of:) { old, new in }` not single-parameter `onChange` (iOS 17+)
- `sensoryFeedback(_:trigger:)` not UIKit feedback generators (iOS 17+)
- `Tab` API not `tabItem(_:)` (iOS 18+)
- `@Animatable` macro not manual `animatableData` (iOS 26+)
- `scrollIndicators(.hidden)` not `showsIndicators: false`
- `containerRelativeFrame()`/`visualEffect()` over `GeometryReader` when possible
- `@Entry` macro for custom environment/focus/transaction/container values
- Text interpolation not `Text` concatenation with `+`
- `#Preview` not legacy `PreviewProvider`
- `ImageRenderer` not `UIGraphicsImageRenderer` for SwiftUI-to-image

### View Composition

- Extract complex views into separate `struct` subviews in their own files. Never use computed properties or methods returning `some View` for complex sections — even with `@ViewBuilder`.
- Each type (struct, class, enum) in its own Swift file.
- Button actions extracted into separate methods — no inline logic in closures.
- Business logic not inline in `body`, `task()`, or `onAppear()` — move to models/services.
- Prefer modifiers over conditional views for state changes (e.g. `.opacity` not `if`/`else`). Ternary for modifier toggling preserves structural identity.
- Container views use `@ViewBuilder let content: Content`, not closure.
- Use `overlay`/`background` for decoration; `ZStack` for peer composition.
- `.compositingGroup()` before `.clipShape()` on layered views to avoid antialiasing fringes.
- Avoid `AnyView`. Use `@ViewBuilder`, `Group`, or generics.
- Prefer `TextField(axis: .vertical)` over `TextEditor` unless full-screen editing is required.
- Prefer `Button("Label", systemImage: "plus", action: myAction)` when action can be direct parameter.
- `TabView(selection:)` uses enum binding, not integer or string.
- Avoid `Binding(get:set:)` in body — use `@State`/`@Binding` + `.onChange()`.
- Numeric `TextField`: bind to `Int`/`Double` with `format:`, plus `.keyboardType(.numberPad/.decimalPad)`.

### Animation Rules

- Prefer `@Animatable` macro over manual `animatableData`. Use `@AnimatableIgnored` for non-animatable properties.
- Chain animations via `completion` closure in `withAnimation()`, never via multiple `withAnimation` calls with delays.
- Transitions require animation context outside the conditional — not inside.

### Performance Rules

- No object creation in `body` (formatters, etc. — prefer `Text(value, format:)` or `static let`).
- No heavy computation in `body` (sorting, filtering — move to model or `.onChange`).
- Derived state computed, not stored separately (unless with explicit invalidation logic).
- Pass only needed values to views, not entire config objects.
- `Self._logChanges()` (iOS 17+) to debug unexpected view updates.
- `LazyVStack`/`LazyHStack` for large collections. Flag eager stacks with many children.
- Gate frequent scroll position updates by thresholds, not on every pixel.
- Sendable closures (`Shape.path`, `visualEffect`, `Layout`) capture values via capture list.
- View initializers must be lightweight — move work to `task()`.
- `task()` preferred over `onAppear()` for async work (auto-cancels on disappear).
- Avoid escaping `@ViewBuilder` closures on views; store built view results instead.
- Avoid expensive inline transforms in `List`/`ForEach` initializers when repeated often.
- If `ScrollView` has opaque static solid background, use `scrollContentBackground(.visible)` for efficiency.

### Sheets & Navigation

- `.sheet(item:)` over `.sheet(isPresented:)` for model-based content.
- When `.sheet(item:)` view takes item as only init param, use `sheet(item: $item, content: SomeView.init)`.
- Sheets own their actions and dismiss internally via `@Environment(\.dismiss)`.
- Enum-based `Identifiable` type with `.sheet(item:)` for multiple sheet types.
- `NavigationStack` with `navigationDestination(for:)` for type-safe navigation. Flag old `NavigationLink(destination:)`.
- Never mix `navigationDestination(for:)` and `NavigationLink(destination:)` in same hierarchy.
- `navigationDestination(for:)` registered once per data type — flag duplicates.
- `NavigationSplitView` for sidebar-driven multi-column layouts.
- Attach `confirmationDialog()` to the UI element that triggers it (Liquid Glass animation source).
- Single "OK" dismiss alert: omit the button entirely.

### Accessibility

- `Button` for all tappable elements (not `onTapGesture`). If `onTapGesture` must be used, add `.accessibilityAddTraits(.isButton)`.
- Buttons with image labels must always include text: `Button("Label", systemImage: "plus", action: myAction)`. Flag icon-only buttons.
- Same rule for `Menu`: include text label, not just image.
- Built-in text styles or Dynamic Type-aware custom fonts. Never force specific font sizes.
- `@ScaledMetric` for custom spacing/sizing values. iOS 26+: `.font(.body.scaled(by:))` also available.
- Decorative images: `Image(decorative:)` or `.accessibilityHidden(true)`. Flag images with unclear VoiceOver readings.
- Group related elements with `accessibilityElement(children:)`.
- Respect Reduce Motion — replace motion-based animations with opacity.
- Respect `accessibilityDifferentiateWithoutColor` — use icons/patterns/strokes beyond just color.
- Use `accessibilityInputLabels()` for buttons with complex or live-updating labels.
- Minimum tap target: 44×44 points.
- `.caption2` is extremely small — generally avoid. `.caption` is borderline.

### Design & HIG

- Place standard fonts, sizes, colors, spacing, padding, rounding, and animation timings in a shared constants enum for uniform design.
- Never use `UIScreen.main.bounds`. Use `containerRelativeFrame()`, `visualEffect()`, or `GeometryReader` as last resort.
- Avoid fixed frames unless content fits — prefer flexible sizing for Dynamic Type and device variance.
- Use `ContentUnavailableView` for empty/missing data. For search: `ContentUnavailableView.search` (auto-includes search term).
- Use `Label` for icon+text side by side, not `HStack`.
- Prefer system hierarchical styles (`.secondary`, `.tertiary`) over manual opacity.
- Wrap `Slider` in `LabeledContent` inside `Form`.
- `RoundedRectangle` default style is `.continuous` — don't specify explicitly.
- Use `bold()` not `fontWeight(.bold)`. Avoid scattering `.fontWeight(.medium/.semibold)`.
- Avoid hardcoded padding/spacing unless specifically requested.
- Avoid `UIColor` in SwiftUI — use SwiftUI `Color` or asset catalog colors.
- Use generated symbol asset API: `Image(.avatar)` not `Image("avatar")` when project is configured.
- Use automatic grammar agreement for supported languages: `Text("^[\(count) person](inflect: true)")`.

### Liquid Glass (iOS 26+)

- Only adopt when explicitly requested.
- `GlassEffectContainer` wraps grouped glass elements.
- `.glassEffect()` applied after layout modifiers.
- `.interactive()` only on user-interactable elements.
- Always `#available(iOS 26, *)` with material-based fallback.

### SwiftData

- If using SwiftData with CloudKit: never `@Attribute(.unique)`, all properties have defaults or are optional, all relationships optional.

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

## Hygiene

- Never include secrets/API keys in the repository.
- Code comments where logic isn't self-evident.
- Unit tests for core logic. UI tests only where unit tests aren't possible.
- No third-party frameworks without asking first.
- Feature-based folder structure.

---

## Verification Order

For all code changes: **build → types → lint → tests**