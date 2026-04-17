# Cross-Platform Strategy

Reference loaded when the feature or product touches a decision between building natively per platform, using a cross-platform framework (Flutter), or running on the web.

This file decides **platform commitment and code-sharing model**. Implementation rules for iOS (Swift, SwiftUI, SwiftData) and backend live in their own rules files.

---

## When Platform Choice Is a Decision

Decide when:
- Starting a new product or a new major client surface
- Target audience spans multiple platforms (iOS + Android + web)
- Backend is not ready and platform choice is coupled to backend capability
- Team size is small and maintaining multiple codebases is questionable

Skip when:
- Adding a feature to an existing platform-committed codebase
- Platform is forced by the category (e.g., iOS-only ASO strategy, Chrome extension only runs in browsers)

---

## Platform Options

Three live options. Native iOS is the default for the mobile surface given existing commitment; other options earn their place against it.

| Platform | Strengths | Costs |
|----------|-----------|-------|
| **Native iOS (Swift/SwiftUI)** | Best UX, full platform-API access, first-class OS updates, tooling maturity | iOS-only — Android and web are separate builds; cannot ship a single codebase |
| **Native Android (Kotlin)** | Same strengths on Android side | Android-only; doubles the codebase if iOS is also native |
| **Flutter** | One codebase for iOS + Android (and increasingly web + desktop); consistent UI across platforms | Non-native feel in edge cases; platform-API access via plugins; team learns Dart + Flutter; native-first features lag |
| **Web** | Runs anywhere with a browser; zero install friction; fastest iteration cycle | Limited device-API access; push notification UX weaker than native; discoverability via search, not app stores |

---

## Decision Tree

```
Is the product's primary surface a mobile app?
├─ Yes
│   ├─ Only one mobile platform (iOS-only ASO strategy, or Android-only)?
│   │   └─ Native for that platform (iOS → Swift, Android → Kotlin)
│   ├─ Both platforms needed from day one?
│   │   ├─ Team can afford two native codebases?
│   │   │   └─ Native per platform (best UX, highest ongoing cost)
│   │   └─ Team is small + feature set is UI-centric rather than platform-API-heavy?
│   │       └─ Flutter (single codebase, acceptable UX for most consumer apps)
│   └─ iOS first, Android later?
│       └─ Native iOS now; revisit platform decision when Android becomes a priority
└─ No (web-first or browser extension)
    ├─ Web app (SaaS, landing page, dashboard) → Web
    └─ Browser extension → Web (Chrome/Firefox/Safari extension APIs)

Does the product need presence on multiple surfaces simultaneously (mobile + web)?
├─ Yes → Native mobile + separate web app, with shared backend
└─ No → Single surface, no cross-platform decision
```

### Shortcuts

- iOS-first indie product with small team → **Native iOS**. Cross-platform decisions defer until Android is committed.
- Browser extension → **Web** (TypeScript + extension APIs).
- SaaS landing page, dashboard, or admin tool → **Web**.
- Product that must launch on iOS + Android simultaneously with solo or tiny team → **Flutter** (accept the UX trade-offs to ship).

---

## Code Sharing Model

Decide what (if anything) is shared between platforms.

| Model | Shared | Platform-specific |
|-------|--------|-------------------|
| **Nothing shared** | — | Everything per platform |
| **Backend + contracts** | API + data schemas | All UI and client logic per platform |
| **Business logic via library** | Pure domain logic (Rust, Kotlin Multiplatform, shared TypeScript) | UI and platform integrations |
| **Everything (cross-platform framework)** | UI + logic + assets | Minimal platform-specific shims |

### For a solo developer

- **Backend + contracts** is always worth it. API schemas, types, validation live in one source. Generate per-platform types from it.
- **Business logic library** is worth it when the logic is complex and stable. Not worth it when it changes rapidly with UI.
- **Full cross-platform framework** is worth it only when the alternative (two native codebases) genuinely exceeds team capacity.

Default for a solo dev with native iOS commitment: **backend + contracts shared; UI and client code per platform when a second platform is added.**

---

## Trade-offs to Surface

When recommending **Native (per platform)**, name what it costs:
- Two (or three) codebases to maintain
- Features must be implemented twice
- Hiring or context-switching cost

When recommending **Flutter**, name what it costs:
- Non-native components in edge cases (tabbed navigation, platform-specific system UI)
- Platform-API access via plugins — new OS features lag
- Team must learn Dart + Flutter + platform-specific channels
- SDK ecosystem thinner than native

When recommending **Web** for a product that could be mobile, name what it costs:
- No App Store / Play Store discoverability (keyword ASO not available)
- Push notification UX weaker than native
- Install friction (users must bookmark / "add to home screen")
- Limited access to camera, media library, sensors, background tasks

---

## Anti-Patterns

- **Cross-platform for its own sake** — picking Flutter because "it's modern" when the target is iOS-only. Doubles complexity for zero gain.
- **Shared code that shouldn't be** — forcing UI consistency across platforms where users expect platform-native conventions (navigation patterns, gesture handling, typography).
- **Native when cross-platform would do** — two codebases for a small solo team when the feature set is UI-centric and uniform. Burns maintenance capacity.
- **Mixing frameworks in one product surface** — mostly-native with a few Flutter views, or a Flutter module embedded in a native iOS app. Every interop boundary is a bug source.
- **Ignoring the web option** — forcing mobile-app distribution for a product that would work as a web app. App store friction (installs, reviews, updates) is a real conversion tax.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Platform commitment | `Product ships as [native iOS / Flutter / web] as its primary surface for [target audience] (verified by distribution channel and build artifact)` |
| Shared contract | `API contract is the single source of truth for data shapes across clients (verified by schema-driven type generation passing in CI for all clients)` |
| Parity scope | `Feature parity across platforms is defined explicitly — platforms are not silently allowed to drift (verified by feature flag matrix review per release)` |

### Architectural Decisions

```
Platform: native iOS (Swift + SwiftUI). Rationale: product's primary surface is a consumer iOS app; team commitment and existing rules favor native; Android is not on the near-term roadmap.

Platform: Flutter. Rationale: product must launch on iOS and Android simultaneously with a solo developer; feature set is UI-centric with minimal platform-specific API access; accepting non-native edge cases to ship both platforms within capacity.

Platform: web. Rationale: product is a browser-resident tool (extension or SaaS); mobile app distribution is not a strategic channel for this feature; iteration speed and install-free access outweigh native UX advantages.

Code sharing: backend + API contracts only; per-platform client code. Rationale: solo-dev capacity is spent best on platform-native UX; logic is not complex enough to warrant a shared library; contracts ensure clients agree on data shapes.
```

### Open Questions

```
Android commitment timing: day-one parity with iOS, or iOS-first followed by Android later? Trade-off: day-one parity either doubles development cost (native) or trades UX for shared codebase (Flutter); iOS-first delays Android revenue but preserves focus.

Web companion for mobile product: web app alongside the mobile app, or mobile-only? Trade-off: web expands reach and enables landing-page SEO, but splits development attention.
```