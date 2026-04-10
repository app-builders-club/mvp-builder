---
paths:
  - "**/*.swift"
  - "**/Package.swift"
  - "**/*.xcodeproj/**"
  - "**/*.xcworkspace/**"
  - "**/*.xcdatamodeld/**"
  - "**/Info.plist"
---

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
- `Task.sleep(for: .seconds(1))` not `Task.sleep(nanoseconds:)`.
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
3. Default isolation is per-module — neighboring modules and dependencies can use different defaults.

### Non-Negotiable Rules

- Never use GCD (`DispatchQueue.main.async`, `DispatchQueue.global`, etc.) in app-level code. GCD is acceptable in low-level libraries, framework interop, or performance-critical synchronous sections.
- Never use `Task.sleep(nanoseconds:)` — use `Task.sleep(for:)`.
- Never recommend `@MainActor` as a blanket fix. Justify why the code is truly UI-bound.
- When evaluating `MainActor.run()`, check if default isolation is MainActor first — it may not be needed.
- Prefer structured concurrency (`async let`, `TaskGroup`) over unstructured `Task { }`. Use `Task.detached` only with a documented reason — it sheds actor isolation AND priority.
- If recommending `@preconcurrency`, `@unchecked Sendable`, or `nonisolated(unsafe)` — require a documented safety invariant and a follow-up removal plan. Check if Swift 6 region-based isolation makes it unnecessary first.
- `@unchecked Sendable` only for types with internal locking that are provably thread-safe. Never to silence compiler errors.
- Optimize for the smallest safe change. Do not refactor unrelated architecture during migration.
- Never add fake `await` (e.g. `Task.yield()`) to silence `async_without_await` lint. Remove `async` or suppress narrowly.
- Flag mutable shared state not protected by an actor or `@MainActor` (unless default isolation is MainActor).
- If an API offers both `async/await` and closure-based variants, always use `async/await`.
- After 3 failed fix attempts — stop and question the architecture.

### Tool Selection

| Need | Tool |
|------|------|
| Single async operation | `async/await` |
| Fixed parallel operations (known count, different types) | `async let` |
| Dynamic parallel operations (runtime count, same type) | `withTaskGroup` |
| Fire-and-forget child tasks (no results needed) | `withDiscardingTaskGroup` |
| Sync → async bridge | `Task { }` (inherits actor context) |
| Shared mutable state | `actor` |
| UI-bound state | `@MainActor` (only for truly UI-related code) |
| CPU-heavy offloading (Swift 6.2) | `@concurrent` |
| Synchronous locking (iOS 18+) | `Mutex` |
| Bridging completion handlers | `withCheckedThrowingContinuation` |
| Bridging delegate streams | `AsyncStream.makeStream(of:)` |

### Actor Rules

- **Reentrancy is the #1 concurrency bug**: after every `await` inside an actor, all assumptions about state are invalidated. Never assume state unchanged after `await`.
- Capture async result into a local before writing to actor state. For dedup, store in-flight `Task` handles.
- Force unwrap (`!`) on actor state after `await` is a latent crash — another caller may have set it to nil.
- Flag actor types that mostly forward work or own little mutable state — they may not need to be actors.
- `MainActor.assertIsolated()` for debugging (debug builds only, compiled out of release).
- `@MainActor` propagates to: subclasses, extensions, conformances to `@MainActor` protocols (including SwiftUI `View`). Does NOT propagate to closures passed to non-isolated functions.

### Swift 6.2 Behavior Changes

- **`nonisolated` async functions stay on caller's actor by default** — no longer hop to background. Use `@concurrent` to explicitly offload CPU-heavy work.
- `Task.immediate` starts executing synchronously on caller's executor up to first suspension point.
- `isolated deinit` runs deinitializer on the class's actor — needed when teardown touches actor-protected state.
- Task naming: `Task(name: "MyTask") { }` and `group.addTask(name:)` — debugging aid for logs/tracing.

### Structured Concurrency

- Task groups over loops — `for item in items { Task { } }` loses cancellation propagation and error collection.
- Limit concurrency manually when needed: start N initial tasks, add next as each completes.
- For partial results when one child throws: catch errors inside each child task, return `Result`.

### Cancellation

- Cancellation is cooperative — `task.cancel()` only sets a flag. Code must check `Task.checkCancellation()` or `Task.isCancelled`.
- CPU-bound loops with no `await` never see cancellation unless checked explicitly.
- Always filter out `CancellationError` before handling other errors — it's a normal lifecycle event, not a user-facing error.
- Cancel stored tasks before starting new ones + cancel on `deinit`.
- SwiftUI `.task()` cancels automatically on disappear — prefer over `onAppear` + `Task { }`.
- `withTaskCancellationHandler` bridges Swift cancellation to legacy APIs with their own cancel mechanism.

### AsyncStream

- Prefer `AsyncStream.makeStream(of:)` factory over closure-based initializer.
- Continuation must be finished exactly once. Zero = consumer hangs forever. Twice = programmer error.
- Set buffering policy for high-throughput: `.bufferingNewest(n)` or `.bufferingOldest(n)`. Default `.unbounded` can cause unbounded memory growth.
- `for await` loop stops on cancellation or finish — cleanup code after the loop still runs.

### Bug Patterns to Flag

- Actor check-then-act across `await` (reentrancy).
- Unstructured tasks in loops (use task groups).
- Swallowed errors in `Task { try await riskyWork() }` — error silently lost. Handle inside closure.
- `CancellationError` caught and shown as user-facing error.
- `@unchecked Sendable` on class with mutable vars and no synchronization.
- `MainActor.run {}` when already on MainActor.
- `Task {}` inside `onAppear()` — use `.task()` modifier.

### Diagnostic Fix Order ("Sending x risks data races")

1. Check if region-based isolation already handles it.
2. Mark parameter `sending` (caller transfers ownership).
3. Make type `Sendable` (value type, immutable class, internally synchronized).
4. Check if `nonisolated(nonsending)` resolves it.
5. Last resort: `@unchecked Sendable` with verified correctness.

### Bridging Legacy Code

- Completion handlers → `withCheckedThrowingContinuation`. Resume exactly once on every path. Default to checked variants.
- Delegates (multi-value) → `AsyncStream.makeStream(of:)`. Single-shot delegates → `withCheckedContinuation`.
- `DispatchQueue.main.async` → `@MainActor` function.
- `DispatchQueue.global().async` → `@concurrent` (Swift 6.2) or task group.
- Serial `DispatchQueue` protecting state → `actor`.
- Leave existing tested completion handler code alone unless modernization is requested — provide async wrappers instead.

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

---

## Synchronization

- Mutex (iOS 18+) for microsecond operations protecting single properties. Actors for async workflows needing suspension.
- Atomic types (iOS 18+) for lock-free counters/flags. `.relaxed` ordering for counters, `.acquiringAndReleasing` for read-modify-write.
- Never hold locks across `await` — deadlock risk: task suspends while holding lock.
- Never use `os_unfair_lock` directly in Swift — struct can move in memory. Use `OSAllocatedUnfairLock` (iOS 16+) or `Mutex` (iOS 18+).
- Never use `DispatchSemaphore.wait()` or `NSLock` in Swift Concurrency tasks — blocks cooperative thread pool, can exhaust all threads. Use `withCheckedContinuation` instead.
- `OSAllocatedUnfairLock` is non-recursive — nested `withLock` = deadlock.

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
- No heavy computation in `body` (sorting, filtering, formatter creation — move to model or `.onChange`).
- Never create `DateFormatter`/`NumberFormatter` in view body — create once, reuse.
- Never create `Binding(get:set:)` in view body — breaks identity tracking. Use `@Bindable` (iOS 17+) or cache binding.
- Derived state computed, not stored separately (unless with explicit invalidation logic).
- Pass only needed values to views, not entire config objects.
- `Self._printChanges()` (debug only, remove before shipping) to debug unexpected view updates.
- Don't store frequently-changing values in `@Environment` (e.g. scroll offset) — triggers checks in all child views. Use direct parameters or `@Observable` model.
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
- `navigationDestination(for:)` outside lazy containers — inside `LazyVStack`/`ForEach` may not be loaded when needed.
- Never mix `navigationDestination(for:)` and `NavigationLink(destination:)` in same hierarchy.
- `navigationDestination(for:)` registered once per data type — flag duplicates.
- Each tab owns its own `NavigationStack` — shared stack across tabs loses state on tab switch.
- `NavigationPath` modifications must be on `@MainActor`. Off-main modifications cause silent failures or corruption.
- Deep links: pop to root before building path. Build parent → child order.
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
- Never use `UIDevice.current.orientation` or `UIDevice.current.userInterfaceIdiom` for layout — wrong in multitasking, Stage Manager, iOS 26 free-form windows. Respond to container size.
- Prefer `onGeometryChange(for:)` over `GeometryReader` — no greedy sizing side effects. Constrain `GeometryReader` with `.frame()` if used.
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

#### Model Rules

- `ModelContext` and model instances must never cross actor boundaries. Persistent identifiers are `Sendable` — send ID and re-fetch in destination context.
- Persistent IDs are temporary before first save (start with "t"). Save before relying on ID.
- Do not use property name `description` in `@Model` classes — explicitly disallowed.
- Do not add property observers to `@Model` classes — silently ignored.
- Enum properties must conform to `Codable`. Enums with associated values are supported.
- `@Attribute(.externalStorage)` is a suggestion (not requirement), applies only to `Data`.
- `@Transient` properties must have a default value, reset on fetch. Prefer computed properties for values derived from stored properties.
- `@Query` only works inside SwiftUI views — never in classes/services. Use `ModelContext.fetch(FetchDescriptor)` outside views.

#### Relationships

- `@Relationship` on one side only — both sides causes circular reference.
- Always specify inverse explicitly: `@Relationship(deleteRule: .cascade, inverse: \Sight.destination)`. SwiftData frequently gets inverse relationships wrong.
- Always set explicit delete rule. Default `.nullify` can orphan objects or crash on non-optional properties. Most common: `.cascade`.
- `#Unique` only once per model. Multiple constraints go as separate key path arrays: `#Unique<Foo>([\.email], [\.username])`.

#### Saving

- Autosave timing is unpredictable — add explicit `save()` when correctness matters.
- No need to check `hasChanges` before saving (unlike Core Data) — just call `save()`.

#### Predicates

- `localizedStandardContains()` for string matching, not `lowercased().contains()`.
- `starts(with:)` instead of `hasPrefix()` (unsupported).
- `!isEmpty` not `isEmpty == false` — the latter crashes at runtime.
- No regex in predicates — compiles but crashes at runtime.
- No computed properties, `@Transient` properties, or custom `Codable` structs in predicates — compiles but crashes.
- Unsupported and won't compile: `hasSuffix()`, `lowercased()`, `map()`, `reduce()`, `count(where:)`, `first`, custom operators.

#### FetchDescriptor Optimization

- Set `propertiesToFetch` to limit fetched properties.
- Set `relationshipKeyPathsForPrefetching` for relationships you know will be used.
- `fetchCount()` for counts — but won't live update without `@Query` or other trigger.

#### Migration

- Always have an explicit migration schema, even for lightweight migrations.

#### Indexing (iOS 18+)

- `#Index<Model>([\.property])` for single-property indexes.
- Compound indexes for properties queried together: `#Index<Model>([\.type, \.author])`.
- Avoid on write-heavy/read-rare data (logging).

#### Class Inheritance (iOS 26+)

- Subclasses must be marked `@available(iOS 26, *)` even if deployment target is iOS 26.
- Both parent and child need `@Model` macro.
- List parent and all child classes in schema — SwiftData can't infer hierarchy.
- Only add subclassing if it has clear benefit — protocols are often simpler.

#### CloudKit Constraints

- Never `@Attribute(.unique)` or `#Unique` — not supported, breaks local data too.
- All properties must have defaults or be optional.
- All relationships must be optional.
- Design for eventual consistency — data may not have synced yet.

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
- Never test SwiftUI views directly — test `@Observable` view models or extracted business logic.

### Assertions

- `#expect` as default assertion. Natural Swift expressions (`==`, `>`, `.contains`).
- Never use `!` negation in `#expect` — `#expect(!isLoggedIn)` defeats macro expansion and gives unhelpful output. Use `#expect(isLoggedIn == false)`.
- `#require` when subsequent lines depend on a prerequisite value (guard + fail early). Also unwraps optionals.
- `withKnownIssue` for temporary expected failures — prefer over blanket disabling. `isIntermittent: true` for flaky issues being debugged.
- `Issue.record("...")` replaces `XCTFail("...")`.
- `#expect(throws: SpecificError.self)` — always name specific error, never broad `Error.self`. Returns the error (Swift 6.1+) for separate validation.
- `#expect(throws: Never.self)` to assert no throw.
- Exit tests (Swift 6.2): `await #expect(processExitsWith: .failure) { }` for `precondition`/`fatalError`.
- Float tolerance: no built-in support. Use Swift Numerics `isApproximatelyEqual(to:absoluteTolerance:)` — don't add dependency without asking.
- `.timeLimit(.minutes(1))` — NOT `.seconds()`. Shorter of suite/test limits wins.

### Parameterized Tests

- Replace duplicate test methods with `@Test(arguments:)`.
- Use concrete literal expectations, not values derived from the input itself.
- No `if`/`switch` branching inside parameterized test bodies — split into separate tests.
- Paired inputs: array of tuples or dictionary, not `zip(allCases, allCases)`.
- `CaseIterable.allCases` only for property-based tests, not example-based mappings.
- Two argument collections form cartesian product — use `zip()` for pairwise.

### Parallelization

- Tests run in parallel by default with randomized order.
- Fix shared-state coupling before adding `.serialized`.
- `.serialized` only affects parameterized tests (runs argument cases one-at-a-time). Applying to non-parameterized test does nothing. Applying to suite only serializes parameterized tests inside it.
- Use in-memory fakes for the fast path.
- Enable Thread Sanitizer (TSan) in a dedicated CI job to catch races that static checks miss.

### Async Testing

- Make test functions `async` directly — don't wrap in `Task {}` or use expectations/semaphores.
- `confirmation("description", expectedCount: N)` for async event validation. All async work must complete before the confirmation closure returns. Range-based counts supported (Swift 6.1+): `expectedCount: 5...10` or `5...`.
- `confirmation(expectedCount: 0)` means "ensure event never happens."
- Never use `Task.sleep` or fixed delays as synchronization — tests become flaky. Await actual operations.
- `@MainActor` on tests only when code under test requires main-actor isolation.
- Test scoping traits with `@TaskLocal` (Swift 6.1+) for concurrency-safe per-test configuration instead of shared mutable setUp.
- Attachments (Swift 6.2): `Attachment.record(codableValue, named:)` for debug data on failures.

### Organization

- `@Test` on function (global or method). `@Suite` only needed when adding display name or traits — any type with `@Test` methods is automatically a suite.
- Prefer `struct` suites for value semantics. Use `init()` instead of `setUp()`, `deinit` (class/actor) instead of `tearDown()`.
- `@available` on test functions, never on suite types.
- Tags for cross-suite grouping and test-plan filtering. Keep naming stable.
- `.bug(id:)` or `.bug("url")` trait for tests related to specific bugs.
- `import Testing` only in test targets.
- Test file/folder structure mirrors production code structure.
- Expose hidden dependencies (URLSession, UserDefaults) via protocol injection for testability.
- Verification methods: pass `sourceLocation: SourceLocation = #_sourceLocation` so failures report the call site.
- Raw identifiers (Swift 6.2): `` func `Strip HTML tags from string`() `` — suggest but don't force unless project already uses them.

### XCUITest (UI Automation)

- Always use `accessibilityIdentifier` for test-critical elements — never localized strings.
- Never `sleep()` — use `waitForExistence(timeout:)` or predicate-based waits.
- Each test independent — no shared state, no order dependency.
- Launch with `--uitesting` and `--reset-state` arguments for clean state.
- Test user-visible behavior, not implementation details (not `cells.count == 10`, but `staticTexts["10 items"].exists`).

### Migration from XCTest

Order: assertions → `@Test` declarations → suite organization → parameterization → traits/tags. Don't rewrite without request.

| XCTest | Swift Testing |
|--------|---------------|
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTAssertNil(x)` | `#expect(x == nil)` |
| `XCTAssertIdentical(a, b)` | `#expect(a === b)` |
| `XCTAssertThrowsError(try f())` | `#expect(throws: SpecificError.self) { try f() }` |
| `try XCTUnwrap(x)` | `let x = try #require(x)` |
| `XCTFail("msg")` | `Issue.record("msg")` |
| `XCTestExpectation` + `wait` | `confirmation` or direct `await` |
| `continueAfterFailure = false` | `#require` (stops on failure) |
| `XCTSkip` | `.enabled(if:)` / `.disabled("reason")` traits |

- **Swift 6.2 + MainActor default**: `XCTestCase` subclasses must be `nonisolated final class` — XCTestCase initializers are nonisolated Objective-C, conflicting with MainActor-isolated subclasses. Mark individual test methods `@MainActor` as needed. Better: migrate to `@Suite struct`.

---

## UIKit-SwiftUI Bridging

- `UIViewRepresentable`: `makeUIView` creates ONCE, `updateUIView` patches — never recreate. Guard updates with equality checks.
- Never modify `center`, `bounds`, `frame`, or `transform` on wrapped UIView — SwiftUI owns layout.
- Coordinator (`class`) for delegate callbacks. Not closures (retain cycles, no protocol conformance).
- Implement `dismantleUIView` for cleanup (observers, timers, KVO).
- `UIHostingConfiguration` for collection/table cells (iOS 16+). `UIHostingController` for screens.
- `sizingOptions: .intrinsicContentSize` on UIHostingController for Auto Layout (iOS 16+).
- Don't call `controller.dismiss(animated:)` from coordinator — use `@Environment(\.dismiss)`.
- Custom `@Environment` keys don't cross the bridge. Use `UITraitBridgedEnvironmentKey` (iOS 17+) or inject via initializer. System traits bridge automatically.
- `UIGestureRecognizerRepresentable` (iOS 18+) for custom gesture recognizers in SwiftUI. No manual target/action.

## Timers

- `Timer.scheduledTimer` uses `.default` RunLoop mode — stops during scroll. Always add to `.common` mode.
- `Timer.publish` in Combine: specify `in: .common` explicitly.
- `DispatchSourceTimer`: `resume()` before `cancel()` — cancelling while suspended = EXC_BAD_INSTRUCTION.
- `DispatchSourceTimer`: dealloc while suspended = EXC_BAD_INSTRUCTION. Resume + cancel before releasing.
- Always `[weak self]` in timer handlers. Selector-based Timer API retains target — prefer block API.
- `timer.invalidate()` alone is insufficient — always follow with `timer = nil`. RunLoop retains scheduled timers; `[weak self]` prevents closure retention but does NOT stop the timer.
- `AsyncTimerSequence` (`ContinuousClock.timer`) for modern async code (iOS 16+). Cancels with task.

## Transferable

- Representation order matters — richest first, fallbacks last. Receivers use first supported.
- `FileRepresentation` importing: copy `received.file` immediately — sandbox extension is temporary.
- Custom UTType needs both Swift declaration (`UTType(exportedAs:)`) AND `UTExportedTypeDeclarations` in Info.plist. Without plist entry, cross-app transfers silently fail.

---

## File Storage Locations

- **Documents/** — user-created content only. Backed up. Never purged.
- **Library/Application Support/** — app data (databases, configs). Backed up. Never purged.
- **Library/Caches/** — re-downloadable content. NOT backed up. Purged under storage pressure.
- **tmp/** — truly temporary. Purged aggressively, even while app running.
- Never store re-downloadable content (images, podcasts) in Documents — bloats backup, risks App Store rejection.
- Mark downloaded content with `isExcludedFromBackup = true` if stored outside Caches.
- Check `volumeAvailableCapacityForOpportunisticUsage` before caching optional content.
- `.completeFileProtection` files inaccessible when device locked — use `.completeUntilFirstUserAuthentication` for background-accessed files.

## Performance Notes

- Order struct fields largest-to-smallest to minimize padding. Two `Bool` fields between two `Int64` fields wastes 14 bytes.
- `reserveCapacity(_:)` on arrays/dictionaries when size is known upfront.
- Prefer non-escaping closures in hot paths — `@Sendable`/`@escaping` closures heap-allocate capture context.
- `unowned` (~2x faster than `weak`) when child lifetime < parent lifetime is guaranteed.

---

## Hygiene

- Never include secrets/API keys in the repository. Use Keychain or server-side proxy.
- Auth tokens in Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`), never `UserDefaults`/`@AppStorage`.
- `PrivacyInfo.xcprivacy` required — declare all Required Reason API usage (UserDefaults, file timestamps, disk space, boot time). App Store rejects without it since Spring 2024.
- Code comments where logic isn't self-evident.
- Unit tests for core logic. UI tests only where unit tests aren't possible.
- No third-party frameworks without asking first.
- Feature-based folder structure.

---

## Verification Order

For all code changes: **build → types → lint → tests**