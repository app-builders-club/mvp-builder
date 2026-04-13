> Part of the [figma-extractor skill](../SKILL.md). Load before Level 3 extraction.

# search_design_system — Query Strategies

`search_design_system` searches across **all subscribed design libraries** for a given file. It's the only way to discover library-published assets — `use_figma` with `getLocalVariablesAsync()` sees only local variables.

---

## Parameters

```
search_design_system({
  query: "button",              // required — text query
  fileKey: "abc123",            // required — target file key
  includeComponents: true,      // default true — published components
  includeVariables: true,       // default true — design tokens
  includeStyles: true           // default true — text/effect/paint styles
})
```

## What It Returns

```json
{
  "components": [{
    "name": "Button",
    "libraryName": "Design System",
    "assetType": "component_set",
    "componentKey": "abc123def",
    "description": "Primary action button"
  }],
  "variables": [{
    "name": "colors/primary/500",
    "variableType": "COLOR",
    "variableSetKey": "set1key",
    "key": "var1key",
    "scopes": ["FRAME_FILL", "SHAPE_FILL"],
    "variableCollectionName": "Colors"
  }],
  "styles": [{
    "name": "Heading/H1",
    "styleType": "TEXT",
    "key": "style1key"
  }]
}
```

## Query Strategy

The query matches against **names** (e.g., "Gray/gray-9", "core/gray/100", "space/400"), not against categories or types. Run multiple short, specific queries — not one compound query.

### Recommended query sequences

**Color tokens:**
```
"gray", "red", "blue", "green", "white", "black", "brand", "accent"
"background", "foreground", "surface", "border", "text", "icon"
```

**Spacing/sizing tokens:**
```
"space", "spacing", "gap", "padding"
"radius", "corner", "round"
"size", "width", "height"
```

**Typography:**
```
"heading", "body", "caption", "label", "display"
"font", "type", "text"
```

**Components:**
```
"button", "input", "card", "nav", "header", "footer"
"avatar", "badge", "toggle", "checkbox", "select"
"dialog", "modal", "tooltip", "menu", "accordion"
```

### If initial searches return empty

- Try shorter fragments or alternate conventions: "grey" vs "gray", "spacing" vs "space"
- Check if the file subscribes to any library at all — empty results across all queries means no linked libraries
- Try a very broad query: "color" or "primary" — if even this returns nothing, libraries aren't connected

## Result Interpretation

### Components

The `componentKey` enables import in `use_figma`:
```javascript
const component = await figma.importComponentByKeyAsync("abc123def");
const componentSet = await figma.importComponentSetByKeyAsync("abc123def");
```

### Variables

The `key` identifies a specific variable in the library. Use `variableCollectionName` to understand the token architecture (is it "Primitives", "Color", "Spacing"?).

### Styles

The `key` enables import:
```javascript
const style = await figma.importStyleByKeyAsync("style1key");
```

## Local vs Library Decision Matrix

After comparing local extraction (Level 1-2) with library search (Level 3):

| Local exists | Library exists | Action |
|---|---|---|
| Yes, matching value | Yes | Local wins — record library as confirmation |
| Yes, different value | Yes | Conflict — flag for resolution, record both sources |
| Yes | No | Local is authoritative |
| No | Yes | Record as `source: "figma-library"` — available for use |
| No | No | Gap — no token for this role |

## Inspect Existing Screens (Alternative)

If the file already has screens using the design system, a `use_figma` call inspecting existing instances gives a more authoritative component map than `search_design_system`:

```javascript
const frame = figma.currentPage.findOne(n => n.name === "Existing Screen");
const uniqueSets = new Map();
frame.findAll(n => n.type === "INSTANCE").forEach(inst => {
  const mc = inst.mainComponent;
  const cs = mc?.parent?.type === "COMPONENT_SET" ? mc.parent : null;
  const key = cs ? cs.key : mc?.key;
  const name = cs ? cs.name : mc?.name;
  if (key && !uniqueSets.has(key)) {
    uniqueSets.set(key, { name, key, isSet: !!cs });
  }
});
return [...uniqueSets.values()];
```

Prefer this over `search_design_system` when existing screens are available — it shows exactly what the team uses, not everything in the library.