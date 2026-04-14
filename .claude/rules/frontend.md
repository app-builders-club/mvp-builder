---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/tailwind.config.*"
  - "**/next.config.*"
  - "**/postcss.config.*"
  - "**/components/**"
---

# Frontend Standards

**Stack:** Next.js 14+ (App Router) · React 18+ · Tailwind CSS · TypeScript

Design decisions (typography, color system, component libraries, animations, assets) are in `design.md`. This file covers web implementation only.

## Font Loading

- Always `next/font` — never Google Fonts via `<link>`
- `display: 'swap'`, subset `latin` only unless multilingual
- `rem`/`em` for font sizes — never `px` for body text
- Fluid `clamp()` for marketing headings; fixed `rem` scale for app UI
- `font-variant-numeric: tabular-nums` for data tables
- Never `user-scalable=no` in viewport meta

## Color Implementation

- Colors via CSS variables mapped to Tailwind — never hardcode HEX in components
- Semantic color tokens in CSS variables — concrete values defined per project, not in this rule
- Plan dark mode from project start — implement both themes before delivery

## Design System References

When `ai-docs/references/design-system.md` exists, it is the token source of truth. Universal consumption rules are in `design.md` — this section covers web-specific mapping.

- **Colors:** Map design-system.md color tokens to CSS custom properties in `:root` / `[data-theme="dark"]`, then reference via Tailwind config `extend.colors`. Never duplicate values — single source in CSS variables.
- **Typography:** Map font tokens to `next/font` setup. Use design-system.md font-family, then apply weights/sizes via Tailwind `extend.fontSize` or direct `text-[size]` classes. If design-system.md specifies a Google Font not yet loaded — add via `next/font/google`.
- **Spacing:** Map spacing tokens to Tailwind `extend.spacing` if project needs non-standard scale. Otherwise use default Tailwind scale (`space-sm: 8px` → `gap-2`). Never arbitrary values (`mt-[13px]`) when a token rounds to a scale step.
- **Shadows/Radius:** Map to Tailwind `extend.boxShadow` / `extend.borderRadius`. Reference by semantic name (`shadow-card`, `rounded-md`).
- **Icons:** Use Iconify/Lucide per `design.md`. Don't import new icon packages unless project already uses them.
- **Components:** Check shadcn/ui for matching base component before building custom. Map design-system.md component variants to component props or Tailwind variant classes.

## Testing

### Stack
- **Unit / Integration** → Vitest + React Testing Library
- **E2E** → Playwright
- Never Jest for new projects

### Principles
- Test user behavior, not implementation details — query by role/label, not test IDs
- Component tests: render → interact → assert visible output
- E2E: cover critical user journeys only — login, core action, payment
- Mock API at network level (`msw`), not by mocking fetch
- No `waitForTimeout` — use Playwright auto-waiting or `waitFor` assertions

### Playwright
- `npx playwright test` for CI, `npx playwright test --ui` for local debug
- One spec file per user journey, not per page
- Use `page.getByRole()`, `page.getByText()` — never CSS selectors
- Screenshots on failure: `use: { screenshot: 'only-on-failure' }`
- Separate test database/environment for E2E — never share with dev

## Non-negotiable Rules

### Next.js / SSR
- All components using hooks, events, or browser APIs → `'use client'`
- Heavy animated components → `dynamic(() => import(...), { ssr: false })`
- Never access `window`/`document` at module level — always inside `useEffect`

### Accessibility (Web-Specific)
- `:focus-visible` for keyboard focus rings — never remove `outline` without replacement
- `aria-hidden="true"` on decorative animations
- `aria-label` on all icon-only buttons
- Gate hover effects behind `@media (hover: hover) and (pointer: fine)`

### Performance
- Respect `prefers-reduced-motion` for all animations
- Pause animations when not in viewport (`useInView`)
- Reduce particle/element count on mobile
- `priority` prop on LCP images
- Only animate `transform` and `opacity` — never layout properties
- Never `transition: all` — specify exact properties

### CSS & Layout
- `cn()` (clsx + tailwind-merge) for conditional classes
- Never arbitrary Tailwind values when scale has it (`mt-4` not `mt-[16px]`)
- Mobile-first responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Use `gap` for sibling spacing — not margins
- Container queries (`@container`) for component-level responsiveness
- `min-h-dvh` instead of `h-screen` — avoids iOS Safari viewport jump
- `env(safe-area-inset-*)` for notch/home indicator spacing
- Height animations: `grid-template-rows: 0fr → 1fr` — never animate `height`

### Animation Implementation
- Custom easing: `cubic-bezier(0.16, 1, 0.3, 1)` for enter, not default `ease`
- Never animate from `scale(0)` — start from `scale(0.95)` + `opacity: 0`
- Exit animations ~75% of enter duration
- Popovers: `transform-origin` from trigger; modals: from center
- CSS transitions for interruptible UI; keyframes for predetermined sequences
- Framer Motion `x`/`y` props are NOT hardware-accelerated — use `transform` string for GPU