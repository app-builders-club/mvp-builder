# Cross-Platform Strategy

Reference for deciding between native-per-platform development and code-sharing approaches (Kotlin Multiplatform, React Native, Flutter). Loaded at PRD stage when platform strategy is a top-level decision, or at feature level when a specific feature's implementation approach is in question.

Grounded in Dropbox's public documentation of abandoning C++ code sharing, Slack's similar experience with Libslack, Airbnb's exit from React Native, and Cash App's ongoing success with Kotlin Multiplatform. The published experiences span both directions — read as honest trade-off analysis, not advocacy.

---

## The Landscape

Five dominant approaches for building for multiple mobile platforms:

| Approach | Code sharing | UI rendering | Best-fit scenarios |
|----------|:------------:|:------------:|---------------------|
| **Fully native (Swift + Kotlin)** | None | Native | Feature parity matters less than velocity per platform; teams have specialists per platform |
| **Kotlin Multiplatform (KMP)** | Business logic | Native | Teams with Kotlin/Android leaning, want shared logic with native UX |
| **React Native** | Most code | Cross-platform renderer | Web/React teams moving to mobile; rapid iteration; acceptable to lag native for a bit |
| **Flutter** | All code | Cross-platform renderer | Greenfield projects, design-consistent branding across platforms, team willing to adopt Dart |
| **Hybrid (Capacitor, Cordova, PWA)** | All code | WebView | Content-heavy apps that are mostly web with light native shell |

These are overlapping, not exclusive. Teams can combine — e.g., native iOS + native Android with Kotlin Multiplatform for shared networking and persistence.

---

## The Case Against Code Sharing

Most published failures follow the same arc: team starts with shared code to save engineering time, discovers the hidden costs, rewrites to native after years of pain. The concrete failure modes are worth internalizing.

### Dropbox's C++ Story

Dropbox's mobile apps from 2013 to ~2019 used shared C++ code across iOS and Android. Engineer Eyal Guthmann documented why they abandoned it.

**Why they adopted it initially:**
- Small mobile team (4 engineers) needed to ship a fast-growing roadmap
- Write once in C++ vs. twice in Java + Objective-C
- Swift and Kotlin didn't exist yet — the native languages of the time were less attractive

**Why they abandoned it:**

*Tooling loss:*
- Non-standard stack means losing Android Studio's Android-specific features, Xcode's iOS-specific features
- Had to build custom build system bridging Gradle and Xcodebuild
- Custom system required constant updates as both build systems evolved

*Frameworks they had to build themselves:*
- **Djinni** — cross-language type declarations and interface bindings
- **json11** — JSON serialization (couldn't use idiomatic platform libraries)
- **nn** — non-nullable pointers for C++ (modern languages have this built in)
- **Background task framework** — trivial with Kotlin coroutines or Swift concurrency, required from scratch in C++

*Platform divergence over time:*
- Background execution APIs diverged (Android WorkManager vs. iOS BGTaskScheduler)
- Camera APIs diverged (different permission models, different lifecycle)
- Even features that started similar drifted over the years

*Hiring crisis:*
- "Difficult to hire replacement senior engineers with relevant C++ experience who would be interested in mobile development"
- Original C++ senior engineers moved to other teams/companies
- Remaining team couldn't fill the technical leadership gap

*Reduced community contribution:*
- Open source contributions in C++ reached fewer developers than native language contributions would have
- Mobile ecosystems are Swift- and Kotlin-native; C++ tooling and libraries lagged

### Slack's Libslack Experience

Slack attempted a similar shared-library approach with "Libslack" — documented by engineer Tracy Stampfli.

**Key differences from Dropbox's experience:**
- Libslack was added when mobile apps were already mature — it was replacing existing functionality
- Had to fit into two different established architectures
- Originally meant for iOS, Android, and Windows Phone; only iOS and Android actually used it

**What went wrong:**
- Release cycles became coupled — iOS and Android now shared a release schedule
- Hotfixes became harder — deciding what to hotfix required understanding both platforms
- Most mobile engineers weren't fluent in C++ — debugging issues in the library required specialists
- Many of the same problems Dropbox documented

### Airbnb and React Native

Airbnb invested in React Native for two years, then sunset it in 2018. Their published reasons aligned with the above:

- Performance issues in production
- React Native team too small to maintain alongside native teams
- Engineers preferring native tooling and languages
- Debugging problems — traces crossing JS/native boundary

Airbnb's takeaway wasn't "React Native is bad" but "React Native doesn't fit our team and use case." Same conclusion, different technology.

### The Common Pattern

In every published case:
1. Team chose code sharing to save time in a specific moment
2. Platform APIs and languages evolved faster than the shared layer
3. Hidden costs (tooling, hiring, debugging, custom infrastructure) accumulated
4. Eventually the overhead exceeded the "write twice" cost the team was avoiding

**The core insight:** code sharing has a fixed adoption cost (infrastructure, tooling, hiring). Native has a per-feature cost (write twice). For small codebases and short timelines, shared code loses. For large codebases on long timelines, it may win. But the break-even is later than teams typically anticipate.

---

## The Case For Code Sharing

Code sharing isn't universally wrong — it's wrong at the wrong scale, for the wrong use cases, with the wrong tools. Cash App's journey illustrates a careful success.

### Cash App with Kotlin Multiplatform

Cash App launched in 2013 with fully native iOS and Android teams. By the time of their Kotlin Multiplatform adoption story, they had 50 mobile engineers split across platforms and 30 million monthly active users.

**Their JavaScript experiment (2016):**
- Introduced a JavaScript runtime for shared server-driven logic on sensitive payment flows
- Continued experimenting with JS as a general sharing tool
- Concluded: "unless circumstances required it, the cost of working with JavaScript outweighed the value of sharing code"
- Specifically: quick development turnaround with small PRs was slowed by JS review overhead

**KMP adoption (2018 onwards):**
- Started behind a feature flag, with Touchlab's help for early-adopter issues
- "Shared business, native UI" philosophy — never shared UI code
- Teams didn't have to give up preferred toolchains (iOS devs still use Xcode, Android devs still use Android Studio)

**Key workflow decisions:**
- Initially introduced Gradle to the iOS build, but "the added cost of running Gradle and rebuilding the project did not make sense"
- Created **separate shared repository** for shared business logic — iOS and Android each pull it in, but their build tools stay native
- Allowed server team (also Kotlin) to contribute to the shared module

**What worked well:**
- **Persistence layer** (using SQLDelight)
- **Pure functions** with no platform integration
- **Network APIs** (using Wire for protobuf)

**What Cash App says clearly:**
- "The vast majority of our code is written natively"
- "Developer happiness and productivity is still the most important thing"
- KMP is an *option*, not a mandate

### Why Cash App's Approach Works

The structural differences from Dropbox's failure mode:

- **Shared business logic only, never UI.** Platform UI remains idiomatic — SwiftUI/UIKit on iOS, Jetpack Compose on Android. No loss of tooling for UI work.
- **Sharing is opt-in per feature.** Teams that benefit from sharing adopt it; teams that don't continue native. No forced migration.
- **Tooling quality is high.** JetBrains' Kotlin tooling, Xcode integration via framework export, shared repo workflow mean iOS devs aren't dealing with Gradle.
- **Language is shared with server-side.** Cash App's server is Kotlin. Server engineers can contribute to shared logic. Skill pool is broader than "mobile-only C++."
- **Shared repository pattern** keeps iOS developer workflow unchanged — they pull in shared code as a framework, not as a Gradle project in Xcode.

### The Cash App Pattern

This generalizes beyond KMP to a broader principle: **share narrow, deep, pure logic; keep everything else native.**

Good candidates for sharing:
- Pure business logic (calculations, validations, formatting)
- Data models and serialization
- Network clients (if protocol is well-defined)
- Persistence schema and queries
- State machines

Poor candidates for sharing:
- UI rendering and layout
- Platform integrations (camera, notifications, background tasks)
- Animations
- Accessibility
- Anything requiring platform-specific APIs

---

## What Shares Well vs. What Doesn't

Distilled from all published case studies:

### Shares Well

**Pure logic and computation.** A pricing algorithm. A credit card validation rule. A JSON parser. No platform APIs touched — same code runs anywhere.

**Data models and schema.** DTO/entity definitions. Database schema (with SQLDelight-style tooling). Validation rules.

**Network protocol implementations.** Once you've committed to protobuf via Wire (or equivalent), the client-side code generation means iOS and Android use identical APIs.

**Well-defined state machines.** Payment processing state transitions, authentication flows, sync engine logic.

### Shares Poorly

**Background execution.** Android's WorkManager is fundamentally different from iOS's BGTaskScheduler and Background URLSession. The abstractions leak through any shared layer.

**Camera and media.** Dropbox's own documentation: "interaction with the camera roll" diverged significantly over years of platform evolution.

**Notifications.** APNs and FCM have different payload constraints, different delivery semantics, different test/debug tooling.

**UI.** Platform design languages (Material on Android, Human Interface Guidelines on iOS) differ meaningfully. Users notice and judge.

**Permissions and privacy.** iOS and Android privacy models diverge (App Tracking Transparency, Privacy Manifests, per-permission OS dialogs).

**Deep OS integration.** Widgets, Siri/Assistant, share extensions, Control Center, etc. All platform-specific.

### The Rule of Thumb

If the code interacts with OS APIs, it belongs native. If the code is pure transformation of data, it can be shared. Most app features mix both — the question is where to draw the line.

---

## Framework-Specific Decision Notes

### Kotlin Multiplatform

**Strengths:**
- "Shared business, native UI" fits well-documented success pattern
- Android developers feel at home; iOS developers face lightest learning curve
- Exports as Xcode framework — feels native from Swift side
- Interop is direct, not via bridge or IPC
- Can be adopted incrementally per feature

**Weaknesses:**
- Tooling on iOS side matures more slowly than Android
- Debugging Kotlin from Xcode is workable but not as smooth as Swift
- Swift interop currently through Objective-C interface (direct Swift interop planned)
- Smaller community than React Native or Flutter

**When to adopt:**
- Team has strong Android/Kotlin presence
- Use case is business logic and persistence, not UI
- Team can tolerate adopting an evolving toolchain
- Server-side is also Kotlin (maximizes shared skill pool)

**When to avoid:**
- No existing Kotlin skills on team
- Use case requires shared UI (Compose Multiplatform is possible but less mature)
- Team has capacity for two native codebases and the code sharing isn't solving a concrete pain point

### React Native

**Strengths:**
- Massive community, huge library ecosystem
- Developers from web/React background productive quickly
- Fast iteration with hot reload
- OTA updates (before App Store/Play Store rejection rules tightened)

**Weaknesses:**
- Bridge between JavaScript and native is a performance and reliability choke point (though the new architecture improves this)
- Debugging across the JS/native boundary is harder than native-only
- Large library ecosystem includes many abandoned libraries
- Native features often require native modules — eventually you're writing Swift/Kotlin anyway
- Airbnb's published experience documents performance and debugging pain at scale

**When to adopt:**
- Team is predominantly React/web engineers moving to mobile
- MVP stage with rapid iteration needs
- UI is close to web-style (forms, lists, content) rather than complex gestures/animations
- Team is prepared to write native modules when RN libraries fall short

**When to avoid:**
- Performance-critical apps (games, video, complex animations)
- Heavy OS integration (background, notifications, widgets)
- Team with strong native expertise and no specific reason to leave it

### Flutter

**Strengths:**
- Consistent rendering across platforms (own rendering engine, not native widgets)
- Smooth animations, strong performance for custom UI
- Dart tooling is good; hot reload works well
- Strong for design-consistent branding — same look everywhere

**Weaknesses:**
- Dart is less widely known than Kotlin, JavaScript, or Swift
- Not idiomatic on either platform — apps can feel slightly "off"
- OS integration requires platform channels (similar pain to RN bridges)
- Smaller library ecosystem than RN

**When to adopt:**
- Greenfield project where branding consistency across platforms matters more than platform idioms
- Small team that can commit to Dart
- UI is custom/branded rather than following platform conventions

**When to avoid:**
- Existing app migration (rewrite cost is large)
- Apps requiring deep OS integration
- Team unwilling to adopt Dart

### Hybrid (Capacitor, Cordova, PWA)

**Strengths:**
- Share essentially 100% of code with web
- Deployment is fast (web release → mobile updated)
- Web engineers can ship mobile apps

**Weaknesses:**
- WebView is slower than native rendering
- iOS WebView has limitations (audio, video, notifications)
- Feels distinctly "web" to users
- Many apps that went hybrid later rewrote native as they scaled

**When to adopt:**
- Content-heavy app where performance isn't critical (news, simple e-commerce, reference tools)
- Web team needs basic mobile presence
- Budget extremely constrained

**When to avoid:**
- User experience is a differentiator
- Performance matters
- OS integration required

### Fully Native

**Strengths:**
- Best performance, best UX, best tooling on each platform
- Full access to latest OS features on day of release
- Hiring pool for native specialists is large and experienced
- No infrastructure tax (custom build systems, bridges, etc.)

**Weaknesses:**
- Write the same feature twice
- Potential for behavior drift between iOS and Android over time
- Requires specialists for each platform

**When to adopt:**
- Default choice for most products
- Any product where UX is a competitive dimension
- Long-lived products where native platform evolution will matter

**When to avoid:**
- Solo founder or very small team
- Rapid prototyping phase before product-market fit

---

## Decision Tree

```
Is this PRD-stage decision (product-level)?
├── Yes → continue below
└── No (feature-level decision for specific feature) → skip to "Per-feature decisions"

Is the team >10 mobile engineers with clear iOS and Android specialization?
├── No → Fully native (don't optimize prematurely; team can adopt native per platform)
└── Yes → continue

Do the features have substantial pure business logic (calculations, validations, state machines)?
├── No → Fully native (KMP gain would be minimal)
└── Yes → continue

Does the team have Kotlin/Android capability and appetite?
├── Yes → Kotlin Multiplatform for shared business logic, native UI
└── No → continue

Is the team predominantly web/React?
├── Yes → Consider React Native if UX can be RN-style; fall back to fully native if UX demands
└── No → Fully native
```

**Per-feature decisions** (feature is complex and you're deciding if it should share code):

- Pure computation, no OS APIs → share in whatever framework team uses
- Touches camera, background tasks, notifications, biometrics → native per platform
- UI-heavy with gestures/animations → native per platform

---

## Migration Patterns

### Adopting Code Sharing Incrementally

Don't migrate an existing app to shared code in a big bang. Cash App's approach:

1. **Feature flag from day one.** Every shared-code path behind a flag, can roll back instantly.
2. **Start with isolated features.** One feature's persistence layer, one feature's business logic. Not cross-cutting infrastructure.
3. **Prove out on low-risk features.** Something non-critical where bugs don't break the business.
4. **Measure team experience.** Are PRs getting merged at the same pace? Are developers happy? Collect qualitative feedback.
5. **Expand gradually.** More features, more teams, as confidence grows.

### Abandoning Code Sharing

Dropbox's lesson: migrating away from shared code is painful but finite. The per-feature rewrite cost is predictable. The shared-code-plus-infrastructure cost keeps growing.

If you're already in pain from shared code:
1. **Stop adding to shared codebase.** New features go native.
2. **Identify highest-pain shared code.** What breaks often? What causes release delays?
3. **Rewrite highest-pain first.** Prove the migration pattern.
4. **Systematically migrate.** One module at a time.
5. **Decommission shared infrastructure** once codebase is minimal.

---

## Common Pitfalls

### Over-Estimating Shared Code Savings

Team thinks "we'll write 50% less code." Reality: OS integration, platform-specific UI, animations, and permissions end up being more than half the work. Actual sharing is 20-30% of total codebase.

**Mitigation:** count lines honestly. Estimate what truly shares before committing. Budget for the infrastructure tax.

### Under-Estimating Infrastructure Cost

Team thinks "we just write shared code and both platforms consume it." Reality: custom build system, bridge code, debugging tools, hiring for hybrid skills — all of this is net-new infrastructure.

**Mitigation:** read Dropbox's post. Map out every piece of infrastructure the project will need. Budget engineering time for it.

### Hiring Difficulty

Cross-platform approaches often assume a hybrid engineer — equally strong in iOS, Android, and the sharing layer. This engineer is rare and expensive.

**Mitigation:** plan for specialists, not generalists. Share code where specialists from both sides can agree on interface. Avoid approaches requiring deep hybrid expertise on every team member.

### Platform Divergence Over Time

Shared code written in 2020 assumes 2020 platform APIs. By 2024, platforms have diverged significantly. Shared code accumulates platform-specific hacks until it's shared in name only.

**Mitigation:** accept that platform divergence is unavoidable. Design shared code to be small and simple, not to abstract over everything. Prepare to fork shared code when divergence exceeds abstraction budget.

### UI Framework Lock-In

Team adopts Flutter. Two years later, wants to integrate with a native feature that doesn't have Flutter plugin. Has to write native module, bridge, and maintain both versions forever.

**Mitigation:** native UI is the safest choice for long-lived apps. If adopting cross-platform UI framework, accept that platform integration will be ongoing overhead.

### Shared UI Complexity

Even with best cross-platform UI frameworks, platform-specific UX details (navigation patterns, system fonts, accessibility APIs) diverge. Shared UI code becomes "if iOS else" switches everywhere.

**Mitigation:** lean toward "shared business, native UI" (Cash App pattern) unless consistency of appearance is explicitly more valuable than platform idiom (rare).

### Release Coupling

Shared codebase ships on single schedule. Hotfix for one platform blocked by unrelated issue on other platform.

**Mitigation:** keep shared code minimal so platforms can hotfix independently. Version shared code; platforms can pin to compatible versions during hotfix.

---

## Required Behaviors — Templates for Skill Output

Cross-platform strategy rarely generates feature-level required behaviors — it's a structural decision. When it does:

| Behavior | Template |
|----------|----------|
| Platform UX fidelity | `Feature follows platform design guidelines on iOS (HIG) and Android (Material) rather than cross-platform unified styling (verified by design review on each platform)` |
| Shared code isolation | `Shared business logic is free of platform-specific APIs and testable without mocking platform layers (verified by shared module compilation and unit test execution)` |
| Platform integration isolation | `OS integration (camera, background, notifications) implemented natively per platform, not in shared layer (verified by code review of shared module) ` |
| Migration safety | `Shared code rollout gated behind feature flag for immediate rollback if bugs discovered in production (verified by feature flag configuration test)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions about platform strategy:

```
Platform strategy: fully native iOS (Swift/SwiftUI) and Android (Kotlin/Compose), no shared code. Rationale: team at MVP stage without capacity for cross-platform tooling overhead; Dropbox and Slack documented that shared-code approaches cost more than expected at smaller team sizes. Revisit when team exceeds 10 mobile engineers and substantial pure-logic features emerge. Source: Dropbox "The (not so) hidden cost of sharing code."

Platform strategy: Kotlin Multiplatform for shared business logic (persistence, network clients, state machines, pure calculations), with native UI on each platform. Shared code lives in separate repository consumed by iOS as Xcode framework, Android as Gradle module. Rationale: enables iOS and Android teams to maintain native toolchains while sharing tested business logic; proven at scale by Cash App. Source: Cash App KMP case study.

Platform strategy: React Native for primary codebase with native modules for OS-specific features. Rationale: team is predominantly web engineers, rapid iteration needed for MVP, UI is content-heavy rather than animation-heavy. Acceptable risk: Airbnb documented migration pain at scale — plan to re-evaluate when app size or performance-critical features grow. Source: React Native ecosystem maturity; Airbnb's documented exit.

Platform strategy: Flutter for both platforms. Rationale: greenfield product, design consistency across platforms is a branding requirement, small team committed to Dart. Accept: native-feel trade-off and platform channel complexity for OS integrations.

Feature-level decision: [specific feature] implemented natively per platform despite company-wide KMP adoption. Rationale: feature requires deep OS integration (background tasks, camera pipeline, notifications) — poor candidate for sharing. Shared logic would accumulate platform-specific branches making the shared layer net-negative.

Feature-level decision: [specific feature] shared via KMP. Rationale: pure business logic with no OS integration, ideal sharing candidate. Shared module includes [X, Y, Z] with native UI consuming via defined interface.

Shared code repository: separate repository from platform apps. iOS consumes as binary framework; Android consumes as Gradle module. Rationale: Cash App's lesson — Gradle in Xcode workflow creates friction for iOS developers; separate repo keeps developer workflows native. Source: Cash App KMP repository structure.

Migration plan: adopt KMP incrementally behind feature flags, starting with [low-risk pure-logic feature]. Measure team velocity and developer satisfaction after 3 months before expanding scope. Rationale: documented pattern of gradual adoption reduces risk; feature flags enable fast rollback if issues emerge. Source: Cash App KMP gradual adoption.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **PRD-stage, platform strategy undefined** → full reference applies, walk through decision tree with user
- **User said "cross-platform"** → don't assume which framework; clarify requirements (team, feature types, UX requirements) before recommending
- **User described web team moving to mobile** → React Native as serious option, walk through trade-offs
- **User described design-consistent branding across platforms** → Flutter as candidate, with UX trade-off disclosure
- **User described "single codebase" as goal** → likely a red flag; probe reasoning, present Dropbox/Slack cautionary tales
- **User at MVP stage with small team** → fully native recommended, document that cross-platform is premature optimization
- **User has existing app considering migration** → document migration pain; only recommend if current pain is documented and substantial
- **Feature-level decision for specific feature** → use "What Shares Well vs. Poorly" section to classify the feature

---

## Invariants

- Fully native is the default; cross-platform approaches require documented justification
- "Shared business, native UI" is the most defensible sharing pattern
- Code sharing decisions are reversible; plan migration path (feature flags, separate modules) from day one
- Platform integration (background, camera, notifications, biometrics) always native, regardless of sharing strategy for the rest
- Shared code in a separate repository, consumed as framework/module, preserves native developer workflows
- The true cost of code sharing is infrastructure + hiring + tooling, not just lines of code saved
- Published failures (Dropbox, Slack, Airbnb) document common failure modes; not repeating them is the minimum bar
- Published successes (Cash App) document careful adoption patterns; imitation over ambition