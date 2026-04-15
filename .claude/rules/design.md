# Design Standards

## Token Architecture

Three-layer system — never skip layers:

```
Primitive (raw values)  →  Semantic (purpose)  →  Component (specific)
color-blue-600          →  color-primary        →  button-bg
```

- Never use raw color values in components — always reference semantic or component tokens
- Semantic layer enables theme switching (light/dark)
- Name tokens semantically (`space-sm`, `color-primary`), not by value (`spacing-8`, `blue-500`)

## Color System

- Use perceptually uniform color spaces (OKLCH preferred) — equal lightness steps look equal
- Reduce saturation as you approach white or black
- Tint neutrals toward brand hue — creates subconscious cohesion
- Never use pure black or pure white — always tint
- Never use gray text on colored backgrounds — use a darker shade of the background color
- 60-30-10 rule by visual weight: 60% neutral/surface, 30% secondary, 10% accent
- Accents work because they're rare — overuse kills their power
- Every color combination: WCAG AA contrast (4.5:1 normal text, 3:1 large text)
- Plan dark mode from project start — never retrofit
- Dark mode: depth from surface lightness not shadow, desaturate accents, reduce body text weight slightly
- Semantic colors: success (green), warning (amber), error (red), info (blue)
- Never convey information through color alone — always add icon/text
- Theme (light/dark) derived from audience and viewing context, not default preference

## Typography

| Project Type | Heading | Body |
|--------------|---------|------|
| Modern SaaS | Plus Jakarta Sans | Inter |
| Corporate | Source Sans 3 | Source Serif 4 |
| Editorial | Playfair Display | Lora |
| Dev Tools | Geist | Inter |

- Load fonts efficiently — never block rendering
- Base 16px minimum on mobile
- Use relative units for font sizes — respect user system settings
- Line height 1.5–1.6 for body; increase by 0.05–0.1 for light-on-dark text
- Max line length 65–75 characters
- Fewer sizes with more contrast — at least 1.25 ratio between scale steps
- Fluid sizing for marketing headings; fixed scale for app UI
- Max 2 typefaces per page — single family with weight variation often suffices
- Use tabular/monospaced figures for data tables and aligned numbers
- Never disable user zoom/text scaling

## UI Components (Web)

| Need | Library |
|------|---------|
| Forms, dialogs, tables, base UI | shadcn/ui |
| SaaS polish — tickers, marquees | Magic UI |
| Dramatic hero effects — spotlight, 3D | Aceternity UI |

## Animations

| Need | Library |
|------|---------|
| Plays/loops — loaders, feedback | Lottie |
| Reacts to input, has states | Rive |
| Hero backgrounds, entrance effects | Aceternity / Framer Motion |

### Timing

| Duration | Use |
|----------|-----|
| 100–150ms | Instant feedback (button press, toggle) |
| 200–300ms | State changes (hover, menu, tooltip) |
| 300–500ms | Layout changes (accordion, modal, drawer) |
| 500–800ms | Entrance animations (page load, hero) |

### Easing

- Use custom exponential curves — never platform default linear/ease
- Deceleration curve for elements entering (starts fast, settles slow)
- Acceleration curve for elements exiting
- Symmetric curve for state toggles
- Never use bounce or elastic easing — feels dated, draws attention to animation itself

### Rules

- Only animate transform and opacity — never layout properties (width, height, position)
- Never animate from scale(0) — start from ~scale(0.95) + transparent
- Exit animations ~75% of enter duration
- Stagger list items by 30–50ms; cap total stagger time
- Animations must be interruptible — never block user input
- Respect reduced motion preferences — keep functional animations, remove spatial motion
- Pause animations when not in viewport
- High-frequency actions (100+/day) = no animation
- Popovers/popups scale from trigger; modals scale from center

## Assets — Free First

| Asset | Source |
|-------|--------|
| Icons | Iconify / Lucide |
| Avatars | DiceBear, Boring Avatars |
| Photos | Unsplash, Picsum |
| Illustrations | unDraw, Storyset |
| Backgrounds | Haikei, Hero Patterns |

AI generation only when custom branded asset needed and no free alternative exists.
Never use emojis as structural icons — always vector icons.

## Pipeline Artifacts Consumption

When `ai-docs/references/` contains generated artifacts (`design-system.md`, `style-guide.md`, `screens/`), these are the source of truth for implementation. Platform-specific mapping rules live in `frontend.md` (web) and `ios.md` (iOS).

### Token Mapping

- If design-system.md provides `codeSyntax` for a token — use that exact name in code. Auto-generated codeSyntax (marked `†`) should be verified against project conventions.
- Map tokens to platform abstractions (CSS variables, Asset Catalog, enums) — never inline raw values that exist as tokens.
- When tokens are ordered by `usageCount`, high-frequency tokens are core to the design — prioritize their adoption in shared components.
- Tokens with quality warnings (hardcoded colors, orphan variables) may need designer review before adoption.

### Style Guide

- Token bindings in style-guide.md are concrete instructions — apply exactly, not as suggestions.
- `usedIn` data confirms where tokens are actually applied in the design — use for verification, not to limit scope.

### Screen References

- Screenshots in `screens/` are visual truth for validation during implementation.
- Skip system-provided elements visible in screenshots — they are rendered by the platform, not implemented by code. Examples: keyboard, status bar, home indicator (iOS); browser chrome, scrollbar (web).

### Components

- Before creating new components, check existing codebase for matching views. Reuse over recreation.
- Design-system.md `propertyClassification` guides implementation pattern:
  - `state` (Default/Pressed/Disabled) → use platform system state mechanisms before custom enums
  - `size` (Small/Medium/Large) → platform size APIs or custom enum
  - `style` (Primary/Secondary) → single component with parameter when differences are cosmetic, separate components when structure differs
  - `content` toggles (HasIcon, ShowBadge) → optional parameters
- Figma design context from MCP is a specification, not code to port. Read design properties and build native platform code — never translate framework-specific output literally.

## Non-negotiable Rules

### Accessibility
- All interactive elements reachable by keyboard/assistive tech
- Focus states always visible — never remove without replacement
- Decorative elements hidden from assistive tech
- Labels on all icon-only buttons
- Touch targets: min 44×44pt (iOS) / 48×48dp (Android)
- Touch target spacing: min 8px gap
- Hover effects gated behind pointer capability detection — touch users can't hover

### Spacing & Layout
- 4pt spacing base: 4, 8, 12, 16, 24, 32, 48, 64, 96
- Vary spacing for hierarchy — not everything gets the same padding
- Mobile-first, then scale up
- No horizontal scroll on mobile
- Avoid fixed viewport height on mobile — use dynamic values
- Respect platform safe areas (notch, home indicator, status bar)
- z-index: semantic scale (dropdown → sticky → modal-backdrop → modal → toast → tooltip)
- Not everything needs a card — spacing and alignment create grouping naturally
- Never nest cards inside cards

### Forms
- Visible label per input — never placeholder-only
- Error below related field with clear cause + fix
- Validate on blur, not keystroke
- Required fields marked visually
- Loading → success/error state on submit
- Prefer undo over confirmation dialogs for non-destructive actions
- Use platform-appropriate input types for correct keyboard

### Navigation
- Bottom nav max 5 items with labels + icons
- Back navigation must be predictable and preserve state
- All key screens reachable via deep link
- One primary CTA per screen — secondary visually subordinate

## Quality Gate

- Lint: 0 errors
- Type check: 0 errors
- No runtime errors in console/logs
- No failed network requests
- Mobile viewport works
- Verify both light and dark themes before delivery