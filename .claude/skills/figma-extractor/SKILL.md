---
name: figma-extractor
description: "Extract design tokens, styles, component metadata, and screen structure from Figma files via MCP. Use whenever a figma.com URL appears, when someone mentions Figma tokens, variables, design system extraction, screen captures, text styles, shadows, component properties, or library assets. Trigger for phrases like 'get from Figma', 'extract design', 'Figma variables', 'design tokens', 'capture screens', 'get typography from Figma', 'extract shadows', 'find components in library', 'get code syntax for tokens', or any figma.com/design link. Even if the user just pastes a Figma link without instructions, use this skill to parse it and decide what to extract. Covers three extraction depths: Level 1 (quick read-only MCP), Level 2 (deep extraction via Plugin API scripts), Level 3 (library search + component property metadata)."
allowed-tools: Read, Write, Bash(*), mcp__figma__whoami, mcp__figma__get_metadata, mcp__figma__get_screenshot, mcp__figma__get_variable_defs, mcp__figma__get_design_context, mcp__figma__use_figma, mcp__figma__search_design_system, mcp__figma__get_context_for_code_connect
---

# Figma Extractor

Extract design tokens, styles, component metadata, and screen structure from Figma files.

Process: **CHECK → PARSE → DISCOVER → EXTRACT → ORGANIZE**

Every extracted value carries a source tag — downstream consumers use this for conflict resolution priority. A variable definition is stronger evidence than an inferred applied style.

## Extraction Levels

Not every workflow needs every tool. Three levels control extraction depth:

```
Level 1 (Quick):    whoami → get_metadata → get_variable_defs → get_design_context → get_screenshot
                    Fast, read-only MCP tools. No Plugin API.

Level 2 (Deep):     Level 1 + use_figma read-only scripts
                    Adds: collections with modes, codeSyntax, scopes, aliasing chains,
                    text styles, effect styles, paint styles.

Level 3 (Targeted): Level 2 + search_design_system + get_context_for_code_connect
                    Adds: library asset discovery, exact component property definitions.
```

The calling workflow determines the level. When in doubt, start at Level 1 and escalate if data is sparse.

## use_figma Safety Boundary

Level 2-3 use `use_figma` for **read-only extraction scripts only**. Scripts from `scripts/` are pre-built for this purpose.

Rules:
- Scripts MUST NOT create, modify, or delete any nodes, variables, or styles
- Every script ends with `return { ... }` containing extracted data
- If `use_figma` is unavailable → graceful fallback to Level 1
- Pass `skillNames: "figma-extractor"` in every `use_figma` call (logging only)

The calling agent must ensure `figma-use` skill rules are known when using Level 2+ (color range 0–1, `return` pattern, page context reset per call). The scripts in `scripts/` already follow these rules.

## Source Tags

Every extracted value is tagged with its source. Priority for conflict resolution:

| Tag | Meaning | Priority |
|---|---|---|
| `figma-variables` | Explicitly defined Figma Variable | Highest |
| `figma-library` | Asset from a subscribed design library | Medium |
| `figma-context` | Inferred from applied styles on frames | Lowest |

---

## Step 0: CHECK — Verify MCP Connection

```
whoami()
```

If this fails → warn user, skip all Figma steps. Don't attempt tool calls that will error out.

## Step 1: PARSE — Get IDs from URL

### URL Formats
```
https://figma.com/design/:fileKey/:fileName?node-id=X-Y
https://figma.com/file/:fileKey/:fileName?node-id=X-Y
https://figma.com/proto/:fileKey/:fileName?node-id=X-Y
```

### What to Extract
- **fileKey**: segment after `/design/`, `/file/`, or `/proto/`
- **nodeId**: `node-id` query param, convert dash → colon (`1-2` → `1:2`)

### Decision Rules

| Condition | Action |
|---|---|
| URL has `/design/`, `/file/`, `/proto/` | Parse and proceed |
| URL has `/board/` (FigJam) | Warn: "FigJam not supported" → skip |
| URL has `/slides/` | Warn: "Slides not supported" → skip |
| No URL, MCP connected | Can still extract variables — `get_variable_defs` works without nodeId |
| No URL, MCP not connected | Warn: "No Figma source available" → skip |
| nodeId missing in URL | Fetch root pages first, then navigate |

## Step 2: DISCOVER — Map File Structure

### 2.1 Fetch Page Overview

Call `get_metadata` at the provided nodeId (or `0:1`). Large files — narrow to individual pages, then identify top-level frames as screens.

### 2.2 Build Screen Inventory

```
SCREENS[] = [{
  nodeId, name, page, width, height,
  slug    ← kebab-case: "Login Screen" → "login-screen"
}]
```

### 2.3 Large File Strategy

1. Fetch page-level metadata first
2. For each page, fetch frame-level children separately
3. Focus on top-level frames — skip deeply nested component internals

---

## Step 3: EXTRACT — Pull Design Data

### Level 1 — Quick Extraction

#### 3.1 Variables (Primary Token Source)

`get_variable_defs` returns a flat map of paths to values. Categorize by inspecting path structure and value types:

```
color/primary/500        → color token
spacing/lg               → spacing token
radius/md                → border-radius token
font/body/size           → typography token
```

Mark all: `source: "figma-variables"`.

**When variables come back empty** — common. Many files use local styles instead of Variables. Fall back to 3.2.

#### 3.2 Design Context (Fallback Token Source)

`get_design_context` returns applied styles, layout, component structure. Use when variables are empty or sparse, or when you need component patterns.

Extract: color fills, text styles, spacing/padding, corner radius, effects, component instances.

Mark all: `source: "figma-context"`.

**Truncation:** If response is too large → fetch child nodes individually via `get_metadata` node IDs, then `get_design_context` per child.

#### 3.3 Screenshots

`get_screenshot` per screen in `SCREENS[]`. Visual truth for implementation and validation. If a screenshot fails → log warning, continue.

---

### Level 2 — Deep Extraction (use_figma scripts)

Level 2 adds data that Level 1 tools cannot provide: variable metadata (codeSyntax, scopes, aliasing chains, modes), text styles, effect styles, paint styles.

**Prerequisite:** `use_figma` tool must be available. If unavailable → stay at Level 1.

#### 3.4 Variable Metadata

Embed [extractVariableMetadata.js](scripts/extractVariableMetadata.js) in a `use_figma` call.

Returns for every local variable:
- Collection name and modes (with defaultModeId)
- `codeSyntax` (WEB, ANDROID, iOS) — the CSS/Swift/Kotlin token name
- `scopes` — which pickers this variable appears in
- `valuesByMode` — resolved values per mode, including alias targets
- Alias chain: if value is `VARIABLE_ALIAS`, the target variable name

**Critical nuance:** `getLocalVariablesAsync()` returns **only local variables**. If empty, it does NOT mean no variables exist — library variables are invisible to this API. Use Level 3 (`search_design_system`) to check linked libraries.

Mark all: `source: "figma-variables"` (enriches 3.1 data with metadata).

#### 3.5 Styles

Embed [extractStyles.js](scripts/extractStyles.js) in a `use_figma` call.

Returns:
- **Text styles**: name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing
- **Effect styles**: name, effects[] (type, offset, radius, spread, color with alpha)
- **Paint styles**: name, paints[] (type, color, opacity)

These are data that no Level 1 tool exposes. `get_variable_defs` doesn't cover styles. `get_design_context` partially infers them from usage but without style names or precise values.

Mark all: `source: "figma-variables"` (styles are explicit design decisions, same as variables).

#### 3.6 Component Inventory

Embed [extractComponentInventory.js](scripts/extractComponentInventory.js) in a `use_figma` call.

Returns for every component set across all pages:
- Name, node ID, page name
- Variant count
- `componentPropertyDefinitions` (property name, type, defaultValue, variantOptions)

Mark all: `source: "figma-variables"`.

---

### Level 3 — Targeted Extraction (library + code connect)

Level 3 adds cross-library search and structured component metadata. Use when the file subscribes to external design libraries or when exact component property definitions are needed for code mapping.

#### 3.7 Library Search

Call `search_design_system` to find tokens, components, and styles across **all subscribed libraries**.

Load [search-strategies.md](references/search-strategies.md) for query patterns and result interpretation before calling. Key rules:
- Query matches against **names**, not categories — use short, specific queries
- Run multiple queries: "gray", "blue", "background", "space", "radius", "button", "card"
- Returns: `components[]`, `variables[]`, `styles[]` with keys for import

Mark all: `source: "figma-library"`.

**Decision after search:**

| Local variable exists | Library variable exists | Action |
|---|---|---|
| Yes | Yes | Keep local (intentional override), note library source |
| Yes | No | Keep local |
| No | Yes | Record as library asset — available for import |
| No | No | No token for this slot |

#### 3.8 Component Properties

Call `get_context_for_code_connect` per component to get **exact property definitions**.

Parameters:
```
fileKey, nodeId (published component/set),
clientFrameworks: ["react"], clientLanguages: ["typescript"]
```

Returns: property definitions with types — TEXT, BOOLEAN, VARIANT (with options), INSTANCE_SWAP. Property names are **case-sensitive** and must match exactly.

This upgrades the Component List from 3.6 by adding precise property schemas instead of just names/counts.

---

## Step 4: ORGANIZE — Structure Results

The caller decides output paths. If no path specified, return data structures in-memory.

Load [data-structures.md](references/data-structures.md) for detailed output schemas.

### 4.1 Unified Token Map

Merge tokens from all sources. `figma-variables` wins over `figma-library` wins over `figma-context`. Level 2 enriches each token with:

```
"primary-500": {
  value: "#3B82F6",
  source: "figma-variables",
  codeSyntax: { WEB: "var(--color-primary-500)" },   // Level 2
  scopes: ["FRAME_FILL", "SHAPE_FILL"],               // Level 2
  aliasOf: "blue/500",                                 // Level 2
  collection: "Color",                                 // Level 2
  modes: { "Light": "#3B82F6", "Dark": "#60A5FA" }    // Level 2
}
```

### 4.2 Component List

```
FIGMA_COMPONENTS = [{
  figmaName: "Button",
  variants: ["primary", "secondary", "ghost"],
  properties: { "Label": "TEXT", "Size": "VARIANT", ... },  // Level 2-3
  confidence: "high",
  source: "figma-variables"
}]
```

### 4.3 Style Maps (Level 2)

```
FIGMA_TEXT_STYLES = [{
  name: "Heading/H1", fontFamily: "Inter", fontStyle: "Bold",
  fontSize: 48, lineHeight: 56, letterSpacing: -1.0
}]

FIGMA_EFFECT_STYLES = [{
  name: "Shadow/Medium",
  effects: [{ type: "DROP_SHADOW", offset: {x:0, y:4}, radius: 6, spread: -1, color: {r:0, g:0, b:0, a:0.1} }]
}]
```

### 4.4 Library Assets (Level 3)

```
FIGMA_LIBRARY_ASSETS = {
  components: [{ name, libraryName, componentKey }],
  variables: [{ name, variableType, key, scopes, collectionName }],
  styles: [{ name, styleType, key }]
}
```

### 4.5 Screen Index

```
FIGMA_SCREENS = [{
  slug, nodeId, name, page, dimensions,
  hasScreenshot, hasDesignContext
}]
```

### 4.6 Extraction Summary

```
Figma Extraction Summary
Source: [URL or "no URL — variables only"]
Level: [1/2/3]
Screens: [N] discovered, [N] with screenshots
Tokens: [N] from Variables, [N] from Context, [N] from Library, [N] total unique
Styles: [N] text, [N] effect, [N] paint
Components: [N] discovered, [N] with property definitions
Warnings: [list if any]
```

---

## Workflows

### Full Extraction (design-setup, Level 2)

```
CHECK  → whoami
PARSE  → URL → fileKey + nodeId
DISCOVER → get_metadata → SCREENS[]
EXTRACT:
  L1: get_variable_defs → tokens
      get_design_context on 2-3 complex screens → tokens + components
      get_screenshot for each screen
  L2: use_figma extractVariableMetadata.js → codeSyntax, scopes, aliases, modes
      use_figma extractStyles.js → text/effect/paint styles
      use_figma extractComponentInventory.js → component sets + properties
ORGANIZE → merge token map, style maps, component list, screen index, summary
```

### Deep Extraction (design-setup with libraries, Level 3)

```
Full Extraction (Level 2) +
  L3: search_design_system → library assets
      get_context_for_code_connect per key component → exact property schemas
ORGANIZE → add library assets, upgrade component properties
```

### Token-Only (validation/comparison, Level 1-2)

```
CHECK  → whoami
PARSE  → URL → fileKey
EXTRACT:
  L1: get_variable_defs → tokens
      If sparse (<5): get_design_context on 1-2 screens
  L2 (if needed): use_figma extractVariableMetadata.js → codeSyntax, scopes
ORGANIZE → token map with sources
```

### Screen Catalog (ux/ui, Level 1)

```
CHECK  → whoami
PARSE  → URL → fileKey + nodeId
DISCOVER → get_metadata → SCREENS[]
EXTRACT: get_screenshot for each screen
ORGANIZE → screen index with screenshots
```

---

## Error Handling

Extraction is **enrichment, not requirement**. The pipeline continues without Figma data — it just has less information.

| Error | Response |
|---|---|
| `whoami` fails | MCP not connected → warn user, skip all |
| Invalid/unsupported URL | Warn → skip |
| Empty variables | Normal — fall back to design context (3.2) |
| Empty local variables + Level 2 | Not an error — check library via Level 3 before concluding "no tokens" |
| `use_figma` unavailable | Fall back to Level 1 — warn about reduced extraction |
| `search_design_system` empty | File may not subscribe to libraries — not an error |
| Truncated response | Narrow scope → fetch children individually |
| Screenshot timeout | Try smaller child frames → continue |
| Permission denied | Warn "check Figma file sharing settings" → skip |

---

## Scripts

Read-only Plugin API helpers. Embed in `use_figma` calls for Level 2 extraction.

| Script | Purpose | Level |
|---|---|---|
| [extractVariableMetadata.js](scripts/extractVariableMetadata.js) | Collections, modes, codeSyntax, scopes, aliases, valuesByMode | 2 |
| [extractStyles.js](scripts/extractStyles.js) | Text styles, effect styles, paint styles with full properties | 2 |
| [extractComponentInventory.js](scripts/extractComponentInventory.js) | Component sets across all pages with property definitions | 2 |

## References

Detailed documentation loaded on demand.

| Reference | Load when | Content |
|---|---|---|
| [search-strategies.md](references/search-strategies.md) | Level 3 — before calling `search_design_system` | Query patterns, result interpretation, local vs library decisions |
| [data-structures.md](references/data-structures.md) | Step 4 ORGANIZE — when building output structures | Detailed schemas for token map, component list, style maps, library assets |

## Quick Reference

| Step | Tool | Level | Purpose |
|---|---|---|---|
| CHECK | `whoami` | 1 | Verify MCP connection |
| DISCOVER | `get_metadata` | 1 | File structure, pages, frames |
| EXTRACT | `get_variable_defs` | 1 | Variable values (flat map) |
| EXTRACT | `get_design_context` | 1 | Applied styles, layout, components |
| EXTRACT | `get_screenshot` | 1 | Visual reference per screen |
| EXTRACT | `use_figma` + scripts | 2 | Deep: metadata, styles, component inventory |
| EXTRACT | `search_design_system` | 3 | Library assets across subscribed libraries |
| EXTRACT | `get_context_for_code_connect` | 3 | Exact component property definitions |