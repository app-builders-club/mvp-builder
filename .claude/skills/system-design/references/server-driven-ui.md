# Server-Driven UI

Reference loaded for Frequent UI iteration features — A/B testing, rapid experiment cycles, server-updatable UI without app release.

This file decides **whether to invest in SDUI for a given surface, and at what granularity**. Implementation (specific framework, rendering engine, schema format) is out of scope.

---

## When SDUI Is a Decision

Consider SDUI when:
- A specific surface (paywall, onboarding, promotional module) needs to change faster than app release cycles permit
- A/B testing requires shipping UI variants without user updates
- Business stakeholders demand control over copy, layout, or flow without engineering round-trips
- The surface is content-heavy (feed cards, promotional carousels, personalized modules)

Skip SDUI when:
- The surface is stable (most product UI)
- Design fidelity or platform-native feel is critical
- The team has no infrastructure investment capacity for the rendering engine

SDUI is a focused tool for specific surfaces, not a whole-app strategy.

---

## Granularity Levels

Three levels of SDUI, each with different investment and flexibility.

| Level | What's server-controlled | Investment | Flexibility |
|-------|---------------------------|-------------|-------------|
| **Remote config** | Copy, colors, feature flags, numeric thresholds | Low | Low — cannot change layout or flow |
| **Template-driven** | Content slots in predefined templates (e.g., "hero image + 3 bullets + CTA") | Medium | Medium — new content shapes but not new templates |
| **Full SDUI** | Arbitrary UI composition from a schema (components, layout, flow) | High | High — server can ship new screens without app update |

### Decision Tree

```
Does the surface need to change faster than app releases?
├─ No → No SDUI
└─ Yes
    ├─ Only copy, images, and numeric thresholds change?
    │   └─ Remote config (simplest, highest ROI)
    ├─ Content shape changes but layout stays stable?
    │   └─ Template-driven SDUI
    └─ Layout, flow, or component composition must change?
        ├─ Surface is high-value (paywall, onboarding, subscription upsell)?
        │   └─ Full SDUI (investment is justified by conversion impact)
        └─ Surface is low-value?
            └─ Don't bother — cost exceeds benefit
```

### Shortcuts

- Paywall that needs rapid iteration for conversion optimization → **Full SDUI** (highest-leverage surface for this pattern)
- Onboarding flow with A/B testing across copy + order of steps → **Template-driven** at minimum, **Full SDUI** if step composition varies
- Feature flags and remote thresholds → **Remote config** (not really SDUI)
- Product home screen / main navigation → No SDUI (stability and native feel win)

---

## Trade-offs to Surface

When recommending **SDUI**, name what it costs:
- Rendering engine complexity — the client must parse, validate, and render arbitrary schemas safely
- Design system lock-in — SDUI works only for components already supported by the engine
- Debuggability — bugs straddle server schema + client renderer; hard to reproduce
- Versioning — old app versions must gracefully degrade when server sends newer schema components
- Testing surface explodes — every server-side variant is a new UI to validate

When recommending **against SDUI**, name what's lost:
- Inability to iterate that surface without a release
- A/B testing constrained to flags, not UI composition

---

## Fallback and Versioning

Any SDUI surface must have a plan for when the server sends something the client cannot render.

- **Versioned schemas** — client advertises supported schema version; server sends compatible schema
- **Graceful degradation** — unknown components render as safe fallback (text description, skeleton, or hidden)
- **Client-side cache** — last-known-good schema cached locally so launch doesn't hang on network
- **Kill switch** — server can force fallback to static UI when the SDUI pipeline is broken

Without these, a bad server deploy brings down user-visible UI.

---

## Anti-Patterns

- **SDUI for the main app surface** — stability and native feel are features, not bugs. SDUI trades them for flexibility users didn't ask for.
- **No fallback plan** — first malformed server response breaks production.
- **Schemas that expose engineering internals** — server sends "SwiftUI View" JSON. Locks server to one platform and one framework version.
- **Testing only happy path** — SDUI's value is variant flexibility; variants must be tested or they regress silently.
- **Remote config smuggled as SDUI** — using a "full SDUI" framework to change one string. Use remote config.
- **No client-side cache** — schema fetched on every app launch; outage = blank screen.

---

## Output Templates

### Required Behaviors

| Behavior | Template |
|----------|----------|
| Server-updatable copy | `[Surface] copy can be changed server-side without app release (verified by remote-config rollout test)` |
| Variant capability | `Multiple [surface] variants can be shipped concurrently to different user segments without app release (verified by segment-targeted variant delivery test)` |
| Fallback on failure | `[Surface] renders a defined fallback when server schema is unavailable or invalid (verified by malformed-schema injection test)` |
| Cache freshness | `[Surface] uses cached schema on cold launch and refreshes in background (verified by offline-launch + schema-update test)` |

### Architectural Decisions

```
SDUI scope: paywall surface only. Rationale: paywall is the highest-leverage conversion surface and iteration velocity materially impacts revenue; other surfaces are stable and do not earn the rendering-engine complexity.

SDUI level: template-driven, not full SDUI. Rationale: paywall variants change content (copy, images, pricing tiers) but share layout; templates cover the needed flexibility without a full rendering engine.

Fallback: last-known-good cached schema on launch, hard-coded fallback variant if cache is empty or corrupted. Rationale: no user sees a blank paywall under any failure condition.
```

### Open Questions

```
Schema source: hand-authored by product, or generated from a design tool? Trade-off: hand-authoring is flexible but slow; generation is fast but constrains design to the generator's capabilities.

Variant assignment: client requests variant from server on each launch, or server pushes variant assignment via user profile? Trade-off: per-launch fetch is simple but adds latency; server-push profile is faster but creates coupling between user service and paywall service.
```