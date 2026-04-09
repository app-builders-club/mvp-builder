# Frontend Standards

**Stack:** Next.js 14+ (App Router) · React 18+ · Tailwind CSS · TypeScript

## UI Components

| Need | Library |
|------|---------|
| Forms, dialogs, tables, base UI | shadcn/ui |
| SaaS polish — tickers, marquees, mockups | Magic UI |
| Dramatic hero effects — spotlight, 3D cards | Aceternity UI |

## Animations

| Need | Library |
|------|---------|
| Just plays/loops — loaders, feedback, empty states | Lottie |
| Reacts to input, has states — buttons, toggles, progress | Rive |
| Hero backgrounds, entrance effects | Aceternity / Framer Motion |

## Assets — Free First

| Asset | Free Source |
|-------|-------------|
| Icons | Iconify / Lucide (`@iconify/react`) |
| Avatars | DiceBear, Boring Avatars |
| Photos | Unsplash, Picsum |
| Illustrations | unDraw, Storyset |
| Backgrounds | Haikei, Hero Patterns |

AI generation (DALL-E) only when custom branded asset needed and no free alternative exists.

## Typography

| Project Type | Heading | Body |
|--------------|---------|------|
| Modern SaaS | Plus Jakarta Sans | Inter |
| Corporate | Source Sans 3 | Source Serif 4 |
| Editorial | Playfair Display | Lora |
| Dev Tools | Geist | Inter |

- Always use `next/font` — never load Google Fonts via `<link>`
- `display: 'swap'`, subset `latin` only unless multilingual
- Use `rem`/`em` for font sizes — never `px` for body text
- Fluid `clamp()` for marketing headings; fixed `rem` scale for app UI
- `font-variant-numeric: tabular-nums` for data tables and aligned numbers
- Never `user-scalable=no` in viewport meta

## Color System

- Colors via CSS variables mapped to Tailwind — never hardcode HEX in components
- Use OKLCH for palette generation — perceptually uniform, better than HSL
- Tint neutrals toward brand hue (chroma 0.005–0.015)
- Every color combination must meet WCAG AA contrast (4.5:1 normal text, 3:1 large text)
- Plan dark mode from project start — don't retrofit
- Semantic colors: success `#22C55E`, warning `#F59E0B`, error `#EF4444`, info `#3B82F6`

## Non-negotiable Rules

### Next.js / SSR
- All components using hooks, events, or browser APIs → `'use client'`
- Heavy animated components → `dynamic(() => import(...), { ssr: false })`
- Never access `window`/`document` at module level — always inside `useEffect`

### Accessibility
- All interactive elements reachable by keyboard
- Use `:focus-visible` for keyboard focus rings — never remove `outline` without replacement
- Never convey information through color alone
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
- For height animations: `grid-template-rows: 0fr → 1fr` — never animate `height`

### Animation (CSS/JS)
- Custom easing: `cubic-bezier(0.16, 1, 0.3, 1)` for enter, not default `ease`
- Never animate from `scale(0)` — start from `scale(0.95)` + `opacity: 0`
- Exit animations ~75% of enter duration
- Popovers: `transform-origin` from trigger; modals: from center
- Use CSS transitions for interruptible UI; keyframes for predetermined sequences
- Framer Motion `x`/`y` props are NOT hardware-accelerated — use `transform` string for GPU

## Quality Gate (before every delivery)

```bash
npm run lint       # 0 errors
npm run typecheck  # 0 errors
```

Browser check: console errors → 0, no failed network requests, mobile viewport works.
Verify both light and dark themes.