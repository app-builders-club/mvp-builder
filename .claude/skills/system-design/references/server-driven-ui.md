# Server-Driven UI (SDUI)

Reference for deciding whether and how to adopt SDUI patterns. Loaded when triage identifies features requiring frequent UI iteration, A/B testing at scale, or cross-platform UI consistency.

This reference is grounded in published case studies from Airbnb (Ghost Platform), DoorDash (Facets, Mosaic), Lyft (Canvas), Uber (ActionCard), Shopify, Delivery Hero (Fluid), and the cautionary tale of Spotify's HubFramework.

**Position this reference takes upfront:** SDUI is rarely appropriate for MVP-stage products. The section below covers when it is — but the default answer for most MVPs is no.

---

## What SDUI Is

In traditional client-driven UI, the client receives data and decides how to display it:

```
Server → { listing_id, title, price, photos, amenities }
Client → decides to render a Card with Title, Hero Image, Price Tag
```

In Server-Driven UI, the server sends both the data *and* the UI structure. The client becomes a rendering engine:

```
Server → {
  layout: VerticalStack,
  sections: [
    { type: "hero_image", props: { url: ... } },
    { type: "title", props: { text: ..., style: "large" } },
    { type: "price_tag", props: { amount: ..., currency: ... } }
  ]
}
Client → maps each section to a pre-built native component, renders in the order and layout the server specified
```

Netflix engineer Christopher Luu describes the shift: client moves from "decision-maker" to "rendering engine." It can display whatever the server describes, but no longer controls what gets displayed.

---

## Spectrum of Approaches

SDUI isn't binary. There's a spectrum from fully client-driven to fully server-driven, with a productive middle ground.

### Fully Client-Driven (default)

- Client owns UI decisions, server provides data
- Every UI change requires app release
- Works for most products indefinitely

### Configuration-Driven UI (partial SDUI)

- Client has native implementations of all components
- Server controls: which components appear, in what order, with what content, with what visibility rules
- Server does not control: component internals, styling details, animation, pixel layout
- Often called "modular UI" or "content-driven layout"

This is the sweet spot identified by multiple engineering teams as "60% of SDUI benefits with 30% of the complexity." Most "successful SDUI implementations end up here, even when they started with grand visions of full SDUI."

### Fully Server-Driven UI

- Server describes entire UI tree including layout, components, styles, actions
- Client is a generic renderer
- Requires schema, DSL for layouts, action dispatcher, component registry, versioning scheme
- This is what Airbnb (Ghost Platform), DoorDash (Facets), Lyft (Canvas) have built

The further right on this spectrum, the higher the infrastructure cost. MVPs should almost never start at "fully server-driven" — the ecosystem takes years to mature.

---

## When SDUI Is Worth It

Clear signals that SDUI investment pays back:

### 1. Multiple Client Platforms with Shared Features

Three+ clients (iOS, Android, web, possibly TVs/cars) rendering the same feature. Without SDUI, three implementations of every feature — diverging over time.

Airbnb Ghost Platform's primary motivation: "each client (Android/iOS/web/mobile web) leverages the exact same response. Upon launching a change from the backend, all clients can immediately reflect the change and render in the exact same manner."

### 2. Feature Velocity Gated by App Releases

Team is shipping UI changes faster than app release cadence allows. Mobile App Store review cycles are 1–7 days; web is instant. If UI changes are weekly, the mobile release bottleneck becomes costly.

Shopify's experience with their Shop app store screen: "launch experiments whenever we deem necessary" rather than being "bound by a weekly release cadence." Fixes that previously took a week to reach users could go live immediately.

### 3. Heavy A/B Testing and Experimentation

Teams running dozens of concurrent UI experiments, each requiring backend logic to select variants. SDUI naturally supports this — variant selection happens server-side, clients just render what they're told.

Uber reports 10x feature velocity on dozens of features after adopting server-driven approaches. The leverage comes from experimentation throughput.

### 4. Mobile Version Fragmentation Problem

Users don't always update apps. Without SDUI, bugfixes for UI logic reach users only when they update. With SDUI, the server can fix presentation bugs instantly across all app versions.

Mobile Native Foundation discussion: "Mobile has always had a versioning problem. Users don't always update their apps" — SDUI directly addresses this for anything UI-layer.

### 5. Old Apps Still in the Wild

Long-tail of users on old app versions. SDUI response can include version-aware fallbacks: new components degrade gracefully on old apps that don't know them.

---

## When SDUI Is a Trap

### The Spotify HubFramework Cautionary Tale

Spotify introduced HubFramework with enthusiasm around 2016. The framework promised teams could "experiment with UI, present content in new exciting ways" while maintaining "a lot less code."

The framework was deprecated in January 2019.

Spotify hasn't published a detailed post-mortem, but their engineering talk "The Silver Bullet That Wasn't" discusses the challenges. Two issues surface:
- iOS-only nature limited the cross-platform benefits (losing the strongest SDUI argument)
- The abstraction didn't provide sufficient value for Spotify's specific use cases

**Lesson:** SDUI's value is highly context-dependent. If the cross-platform argument doesn't apply (single-platform app) or the features don't churn enough (stable UI), the abstraction tax outweighs the benefit.

### Other Trap Signals

- **Single client platform.** You don't get the cross-platform consistency benefit. The abstraction cost remains; the payoff doesn't exist.
- **Low UI churn.** Your features don't change often. Every SDUI investment pays back through avoided future work — if there's no future work, there's no payback.
- **Small team without platform engineering capacity.** SDUI requires a dedicated team to maintain the component library, schema, tooling, and versioning. Product teams can't build features efficiently without this foundation.
- **MVP stage.** You don't yet know which features matter. Investing months in SDUI infrastructure before knowing the product is wrong-headed. Build the product first, adopt SDUI for specific features where it obviously pays off.
- **Team coming from "client-driven" development with no SDUI experience.** Learning curve is substantial. Even Airbnb engineers describe SDUI as "a large amount of complexity and quite a paradigm shift."

### Key Invariant

Doist's engineering blog summarizes: "The success of Server Driven UI work within an organization cannot be determined by the initial release of the work. This is because the benefit of Server Driven UI can only be determined by how much change is required for future work."

SDUI is a bet on future UI iteration. If the iteration doesn't happen (or doesn't happen often), the bet loses.

---

## Case Studies

### Airbnb Ghost Platform (GP)

- Powers search, listing pages, checkout across iOS, Android, web
- Three core abstractions:
  - **Sections**: independent UI components with own data needs (hero, price, amenities)
  - **Screens**: define layout — where and how sections appear
  - **Actions**: user interactions (click, tap, swipe) and their server-side handling
- Backed by Viaduct (GraphQL-based data layer) as unified data-service mesh
- Each section has its own query fragment, colocated with UI code
- Strongly typed models generated from schema across all platforms

**What works well:**
- Simultaneous launches across web/iOS/Android with zero client coordination
- Experimentation: new section types can be added server-side, old apps still render what they know

**Acknowledged trade-offs:**
- "SDUI request and response sizes can get massive, especially for complex screens/sections"
- Mitigations: operation registries (reuse common sections), deferred responses (UI pagination — split a screen across multiple requests)

**Infrastructure investment required:**
- Schema definition and versioning
- Native frameworks on each platform (iOS, Android, web)
- Apollo + Viaduct backend
- Component registry and lazy loading
- Tooling for schema exploration (GraphQL Playground), codegen, mocking

### DoorDash Facets

- Emerged from studying Airbnb GP, Spotify HubFramework, Instacart's approach, and John Sundell's conference talks
- "A Facet maps one-to-one with a view on screen" — predictable relationships between server response and rendered UI
- Powered home screen, store rows, banners
- Mosaic system (related) reduced "time to deliver new banners and tags to under a day"

**Concrete production issues DoorDash identified:**
- **Empty containers problem**: carousel-type components where app doesn't understand children render as empty containers. Need fallback strategy.
- **Version mismatch problem**: new component versions with different identifiers cause older apps to omit views entirely. Need backward-compatible versioning.
- **Unsupported action problem**: components may render successfully but have unsupported action types — user taps, nothing happens, or errors appear on interaction only. Need action-time validation.

**Cross-platform wrinkle:**
- Web DoorDash needed grid layouts; mobile used edge-to-edge. Same component, different platform rendering. Fixed by per-platform layout engines that interpret the same Facet response differently.

### Lyft Canvas — Protobuf Variant

- Uses Protocol Buffers instead of GraphQL
- Chose protobuf for compact binary format and built-in versioning
- Primitives: buttons, layouts, action callbacks defined in .proto schemas
- Renderers on mobile clients and web interpret the protobuf hierarchy

**Why protobuf over GraphQL:**
- Smaller payload (binary, not JSON)
- Built-in field numbering for backward compatibility
- Strongly typed across languages via generated code
- Better suited to high-request-rate scenarios (Lyft serves millions of daily rides)

**When protobuf variant matters:**
- Very high request rates where JSON overhead is measurable
- Teams already invested in protobuf infrastructure
- Real-time / low-latency use cases

**When GraphQL variant matters:**
- Teams already on GraphQL
- Heavy UI iteration where schema evolution matters more than wire efficiency
- Public developer ecosystem (GraphQL is more accessible than protobuf)

### Uber ActionCard

- Enabled onboarding of "people with no previous experience in mobile and web" who could "build new screens just after 2 days"
- Reports 10x feature velocity on dozens of features
- Pattern: predefined card types with slots, composed into feeds and screens

**Key insight:** when SDUI is working well, it lowers the bar for who can build features. Mobile specialists aren't gatekeepers anymore. This is both the productivity multiplier and the social engineering value of SDUI.

---

## Technical Requirements — What You Actually Need to Build

If adopting SDUI, here's the minimum infrastructure stack:

### 1. Component Library on Every Client

Native implementations of every component the server can reference. A `"type": "hero_image"` response maps to a native SwiftUI view on iOS, a Jetpack Compose component on Android, a React component on web. This library must be maintained across platforms indefinitely.

### 2. Schema Definition

How server responses are structured. Usually one of:
- GraphQL schema (Airbnb)
- Protobuf schema (Lyft)
- OpenAPI schema with strong typing

Schema is the contract. Every client reads against this schema. Schema evolution rules define how new components are added without breaking old clients.

### 3. Renderer on Each Client

Generic layout engine that walks the server response and calls the right components. Handles:
- Component dispatch (map `type` → native component)
- Layout (vertical stack, horizontal stack, grid, carousel)
- Action dispatch (click → server-side action handler)
- Unknown component handling (fallback, skip, or error)

### 4. Action System

Server-driven actions. User taps a button → what happens?
- Navigate to screen X (screen ID defined server-side)
- Call API endpoint Y with parameters Z
- Update local state W

Actions are serialized alongside UI. Client dispatches them without understanding what they mean semantically.

### 5. Versioning Scheme

New components must be added in ways that old clients handle gracefully. Options:
- Version numbers on components (`"type": "hero_image_v2"`)
- Capability negotiation (client declares which types it knows; server sends compatible variants)
- Fallback declarations (component specifies which older type to fallback to on unsupported clients)

### 6. Developer Tooling

Without this, engineers can't build features productively:
- Schema exploration (GraphQL Playground, protobuf schema viewer)
- Code generation (client types from schema)
- Mock data generation (test UI without backend)
- Preview tools (render SDUI response in dev environment)

### 7. Observability

SDUI debugging is harder than client-driven (multiple engineers cite this). Need:
- Response logging (what server sent)
- Render tracking (what client rendered)
- Action telemetry (what users tapped, what happened)
- Version distribution (which apps got which schema versions)

### Investment Sizing

Realistic minimum for building this from scratch: 3–6 months for a dedicated platform team of 3–5 engineers, before product teams can use it productively. Maintenance: continuous 1–2 engineers on platform indefinitely.

This is why adopting SDUI mid-MVP is almost always wrong. The investment eclipses the product work.

---

## Common Pitfalls

### Starting with Full SDUI

Team reads Airbnb blog, decides to build Ghost Platform for their 10-person startup. 9 months later, they have a half-built framework and no product. Full SDUI is Airbnb-scale infrastructure.

**Mitigation:** start with configuration-driven UI. Server controls component selection/order/visibility. Native components stay hand-built. Upgrade to full SDUI only if feature velocity and multi-platform consistency demand it.

### Forgetting Old App Versions

New component `"type": "promo_banner_v3"` deployed. Users on old app version see an empty space where the banner should be. Nobody knows until sales complain.

**Mitigation:** every new component type includes a fallback declaration. Old clients render the fallback (or nothing explicit) while new clients render the new type.

### Server-Side Actions Without Validation

Server sends `"on_tap": { "action_type": "navigate_to_screen_xyz" }`. Old client doesn't know `screen_xyz`. User taps — silent failure, or error dialog.

**Mitigation:** client capability negotiation or action-time validation. Log unsupported actions to surface version fragmentation.

### Unlimited Payload Growth

Complex screen returns 500KB JSON. Slow on cellular. Client allocates memory, parses slowly, rendering lag.

**Mitigation:** deferred responses (UI pagination) — return the above-fold immediately, lazy-load below-fold sections. Airbnb's approach.

### Debugging Without Tooling

Bug report: "the home screen looks wrong." Engineer has to trace: which server response was sent, which components should have rendered, which did render, at which version, which A/B variant. Without dedicated tooling, this is hours of work per bug.

**Mitigation:** response logging accessible to engineers (with PII protection). Per-component render tracking. Version and variant telemetry baked in from day one.

### "We'll Make It Generic Later"

Start with SDUI for one feature, plan to extend. A year later, the "framework" is a tangled collection of component-specific hacks. True generalization never happened.

**Mitigation:** platform team owns the SDUI infrastructure. Product teams consume, don't modify, the platform. Generalization requires ongoing engineering investment — budget for it or don't start.

---

## Required Behaviors — Templates for Skill Output

When skill produces output for a feature that might use SDUI, these behavior templates apply:

| Behavior | Template |
|----------|----------|
| Graceful handling of unknown components | `Client renders nothing (or declared fallback) when server sends component type the client doesn't understand (verified by test with mocked unknown type)` |
| Version compatibility | `Older app versions continue to render SDUI screens correctly after server deploys new components (verified by multi-version compatibility test)` |
| Action failure visibility | `Unsupported or failed actions log telemetry and surface error to user when applicable (verified by test with mocked unsupported action)` |
| Response size budget | `SDUI responses for [screen] stay under [N]KB at p95 (verified by payload size monitoring)` |
| Deferred sections | `Below-fold sections load after initial render without blocking critical content (verified by render timeline test)` |
| Render performance | `SDUI screen renders within [N]ms of response receipt at p95 (verified by render performance test)` |

---

## Architectural Decision Templates

When skill produces Architectural Decisions involving SDUI:

```
UI architecture: configuration-driven (partial SDUI). Client has native implementations of all components; server controls component selection, order, and visibility via ordered list response. Rationale: full SDUI requires 6+ months of platform investment inappropriate for MVP stage; configuration-driven gets 60% of benefits (cross-platform consistency, experimentation support) at 30% of complexity. Migrate to full SDUI later if feature velocity justifies. Source: industry pattern documented across Airbnb, DoorDash, others.

UI architecture: fully client-driven. Rationale: single client platform (iOS only), stable feature set, no A/B testing at scale. SDUI infrastructure investment has no payback. Revisit if second platform enters the system.

UI architecture: Ghost Platform-style SDUI with GraphQL schema. Rationale: three client platforms (iOS, Android, web) rendering identical feature set, feature velocity gated by mobile release cycles, platform engineering capacity committed. Source: Airbnb Ghost Platform case study.

Component versioning: capability negotiation at connect time — client declares supported component types, server sends compatible variants. Rationale: avoids empty-container problem documented by DoorDash Facets; old apps continue functioning during rollouts of new component types.

Response transport: GraphQL per Airbnb GP pattern. Rationale: schema evolution tooling is mature, clients already use GraphQL. Alternative (Lyft protobuf) rejected because payload size not yet a constraint and team lacks protobuf infrastructure.

Action system: server-declared action types dispatched by client with capability validation. Client logs unsupported action attempts to telemetry. Rationale: silent action failures are a documented production issue in SDUI systems.

SDUI scope: home screen and checkout flow only. Rationale: these features iterate most frequently, highest A/B testing volume, and are first to benefit from cross-platform consistency. Other screens remain client-driven until clear ROI signal. Source: DoorDash incremental SDUI adoption pattern.
```

---

## Decision Entry Points

Skill navigates this reference based on dialogue answers:

- **User described MVP with single client platform** → SDUI is inappropriate. Recommend client-driven, note SDUI as future option if scale/platforms grow.
- **User described multi-platform product (iOS + Android + web) with shared features** → evaluate configuration-driven UI as minimum; discuss full SDUI trade-offs if heavy iteration expected.
- **User mentioned "rapid experimentation" or "heavy A/B testing"** → configuration-driven UI or partial SDUI likely valuable; confirm iteration volume justifies investment.
- **User described "UI that needs to update without app releases"** → SDUI is the pattern, but warn about infrastructure cost. Suggest starting with configuration-driven approach.
- **User described feature touching checkout / onboarding / core flow with minimum-viable scope** → client-driven default. SDUI overkill for critical-path features that rarely change.
- **User has platform engineering team and multi-year product roadmap** → full SDUI becomes viable option; reference Airbnb/DoorDash architectures.

---

## Invariants

- Default is client-driven UI. SDUI requires explicit justification backed by multiple criteria (multi-platform + high iteration + platform capacity).
- Configuration-driven UI is a valid middle ground — adopt this before full SDUI.
- SDUI investment takes months to pay back; abandon if primary benefits (multi-platform consistency, release decoupling) don't apply.
- Every SDUI system must handle unknown components, unsupported actions, and version skew from day one.
- Response size budgets and deferred loading are mandatory for production SDUI screens.
- Observability infrastructure is as important as the renderer itself — SDUI debugging without tooling is untenable.