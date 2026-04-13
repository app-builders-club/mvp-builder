> Part of the [figma-extractor skill](../SKILL.md). Load at Step 4 ORGANIZE.

# Output Data Structures

Detailed schemas for all data structures produced by the figma-extractor skill. The caller decides output paths and format — this reference defines the structure.

---

## 1. FIGMA_TOKENS — Unified Token Map

Merges tokens from all sources and levels. Source priority: `figma-variables` > `figma-library` > `figma-context`.

### Level 1 (Quick)

```json
{
  "colors": {
    "primary-500": { "value": "#3B82F6", "source": "figma-variables" },
    "surface":     { "value": "#FFFFFF", "source": "figma-context" }
  },
  "typography": {
    "body-size":     { "value": "16px", "source": "figma-variables" },
    "heading-weight": { "value": "700", "source": "figma-context" }
  },
  "spacing": {
    "sm": { "value": "8px", "source": "figma-variables" }
  },
  "border-radius": {
    "md": { "value": "8px", "source": "figma-variables" }
  },
  "shadows": {
    "card": { "value": "0 2px 4px rgba(0,0,0,0.1)", "source": "figma-context" }
  },
  "animation": {},
  "breakpoints": {}
}
```

### Level 2 (Deep) — enriched fields

Each token gains metadata from `extractVariableMetadata.js`:

```json
{
  "colors": {
    "primary-500": {
      "value": "#3B82F6",
      "source": "figma-variables",
      "codeSyntax": {
        "WEB": "var(--color-primary-500)",
        "ANDROID": "colorPrimary500",
        "iOS": "Color.primary500"
      },
      "scopes": ["FRAME_FILL", "SHAPE_FILL"],
      "collection": "Color",
      "aliasOf": "blue/500",
      "modes": {
        "Light": "#3B82F6",
        "Dark": "#60A5FA"
      }
    }
  }
}
```

**Enrichment rules:**
- `codeSyntax` — from variable's `codeSyntax` property. Empty `{}` if not set.
- `scopes` — from variable's `scopes` property. `[]` for primitives (hidden).
- `collection` — the variable collection name.
- `aliasOf` — if the value is `VARIABLE_ALIAS`, the target variable name. Absent if raw value.
- `modes` — resolved value per mode. Single entry if single-mode collection.

### Level 3 — library tokens added

Library tokens from `search_design_system` are added with `source: "figma-library"`:

```json
{
  "colors": {
    "primary-500": { "value": "#3B82F6", "source": "figma-variables", ... },
    "accent-default": {
      "value": null,
      "source": "figma-library",
      "libraryName": "Acme Design System",
      "variableKey": "var1key",
      "collectionName": "Colors"
    }
  }
}
```

Library tokens may have `value: null` — the actual value is resolved at usage time from the library. The `variableKey` enables import via `figma.variables.importVariableByKeyAsync(key)`.

---

## 2. FIGMA_COMPONENTS — Component List

### Level 1 (inferred from design context)

```json
[
  {
    "figmaName": "Button / Primary",
    "dsName": "Button",
    "variants": ["primary", "secondary", "ghost"],
    "confidence": "high",
    "source": "figma-context"
  },
  {
    "figmaName": "Card",
    "dsName": "Card",
    "variants": [],
    "confidence": "medium",
    "source": "figma-context"
  }
]
```

**Confidence levels:**
- `high` — named component instance with clear variant properties
- `medium` — repeated pattern with consistent naming
- `low` — inferred from layout structure, name is ambiguous

### Level 2 (from extractComponentInventory.js)

```json
[
  {
    "figmaName": "Button",
    "nodeId": "123:456",
    "pageName": "Components",
    "variantCount": 18,
    "description": "Buttons allow users to take actions.",
    "properties": [
      { "name": "Label", "type": "TEXT", "defaultValue": "Button" },
      { "name": "Size", "type": "VARIANT", "variantOptions": ["Small", "Medium", "Large"] },
      { "name": "Style", "type": "VARIANT", "variantOptions": ["Primary", "Secondary"] },
      { "name": "State", "type": "VARIANT", "variantOptions": ["Default", "Hover", "Disabled"] },
      { "name": "Has Icon", "type": "BOOLEAN", "defaultValue": true },
      { "name": "Icon", "type": "INSTANCE_SWAP", "defaultValue": "icon-comp-id" }
    ],
    "confidence": "high",
    "source": "figma-variables"
  }
]
```

### Level 3 (enriched by get_context_for_code_connect)

Property definitions become exact — case-sensitive, matching what the Figma API returns:

```json
{
  "properties": [
    { "name": "Label", "type": "TEXT", "defaultValue": "Button" },
    { "name": "Variant", "type": "VARIANT", "variantOptions": ["Primary", "Secondary"] },
    { "name": "Size", "type": "VARIANT", "variantOptions": ["Small", "Medium", "Large"] },
    { "name": "Disabled", "type": "BOOLEAN", "defaultValue": false },
    { "name": "Has Icon", "type": "BOOLEAN", "defaultValue": true },
    { "name": "Icon", "type": "INSTANCE_SWAP", "defaultValue": "icon-comp-id" }
  ]
}
```

**Important:** Property names from `get_context_for_code_connect` are **case-sensitive** and must match exactly when used in code generation or Code Connect mapping.

---

## 3. FIGMA_TEXT_STYLES — Text Style Map (Level 2)

```json
[
  {
    "id": "S:abc123",
    "name": "Heading/H1",
    "fontFamily": "Inter",
    "fontStyle": "Bold",
    "fontSize": 48,
    "lineHeight": { "value": 56, "unit": "PIXELS" },
    "letterSpacing": { "value": -1.0, "unit": "PIXELS" },
    "textCase": "ORIGINAL",
    "textDecoration": "NONE"
  },
  {
    "id": "S:def456",
    "name": "Body/Medium",
    "fontFamily": "Inter",
    "fontStyle": "Regular",
    "fontSize": 16,
    "lineHeight": { "value": 24, "unit": "PIXELS" },
    "letterSpacing": { "value": 0, "unit": "PIXELS" },
    "textCase": "ORIGINAL",
    "textDecoration": "NONE"
  }
]
```

**lineHeight** can be `"AUTO"` (string) or `{ value, unit }` object. Handle both.

---

## 4. FIGMA_EFFECT_STYLES — Effect Style Map (Level 2)

```json
[
  {
    "id": "S:ghi789",
    "name": "Shadow/Medium",
    "effects": [
      {
        "type": "DROP_SHADOW",
        "visible": true,
        "color": { "r": 0, "g": 0, "b": 0, "a": 0.10 },
        "offset": { "x": 0, "y": 4 },
        "radius": 6,
        "spread": -1
      },
      {
        "type": "DROP_SHADOW",
        "visible": true,
        "color": { "r": 0, "g": 0, "b": 0, "a": 0.06 },
        "offset": { "x": 0, "y": 2 },
        "radius": 4,
        "spread": -1
      }
    ]
  }
]
```

**Effect types:** `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`.

**Color values** are 0–1 range (Figma standard). Convert to CSS: `rgba(${r*255}, ${g*255}, ${b*255}, ${a})`.

---

## 5. FIGMA_PAINT_STYLES — Paint Style Map (Level 2)

```json
[
  {
    "id": "S:jkl012",
    "name": "Brand/Primary",
    "paints": [
      {
        "type": "SOLID",
        "visible": true,
        "color": { "r": 0.231, "g": 0.510, "b": 0.965 },
        "opacity": 1
      }
    ]
  }
]
```

---

## 6. FIGMA_LIBRARY_ASSETS — Library Asset Index (Level 3)

```json
{
  "components": [
    {
      "name": "Button",
      "libraryName": "Acme DS",
      "componentKey": "abc123def",
      "description": "Primary action button"
    }
  ],
  "variables": [
    {
      "name": "colors/primary/500",
      "variableType": "COLOR",
      "key": "var1key",
      "scopes": ["FRAME_FILL", "SHAPE_FILL"],
      "collectionName": "Colors"
    }
  ],
  "styles": [
    {
      "name": "Heading/H1",
      "styleType": "TEXT",
      "key": "style1key"
    }
  ]
}
```

---

## 7. FIGMA_SCREENS — Screen Index

```json
[
  {
    "slug": "login-screen",
    "nodeId": "42:15",
    "name": "Login Screen",
    "page": "Authentication",
    "dimensions": "375×812",
    "hasScreenshot": true,
    "hasDesignContext": true
  }
]
```

---

## 8. Extraction Summary

Text format for quick assessment:

```
Figma Extraction Summary
Source: https://figma.com/design/kL9xQn2V/MyApp?node-id=0-1
Level: 2
Screens: 4 discovered, 4 with screenshots
Tokens: 12 from Variables, 4 from Context, 0 from Library, 16 total unique
  - codeSyntax set: 12/12
  - scopes set: 10/12 (2 primitives correctly empty)
Styles: 8 text, 3 effect, 2 paint
Components: 6 discovered, 6 with property definitions
Warnings: none
```