/**
 * extractComponentInventory
 *
 * Read-only extraction script for the figma-extractor skill (Level 2).
 * Returns all component sets and standalone components across all pages,
 * with their property definitions (VARIANT, TEXT, BOOLEAN, INSTANCE_SWAP).
 *
 * Unlike get_design_context which infers components from a single node's
 * applied instances, this script scans the entire file for source component
 * definitions with their full property schemas.
 *
 * Usage: embed this entire script in a use_figma call.
 * Always pass skillNames: "figma-extractor" when calling use_figma.
 *
 * @returns {{
 *   componentSets: Array<{
 *     id: string, name: string, pageId: string, pageName: string,
 *     variantCount: number, description: string,
 *     properties: Array<{
 *       name: string, type: string, defaultValue: any,
 *       variantOptions?: string[]
 *     }>
 *   }>,
 *   standaloneComponents: Array<{
 *     id: string, name: string, pageId: string, pageName: string,
 *     description: string
 *   }>,
 *   summary: { setCount: number, standaloneCount: number, totalVariants: number }
 * }}
 */

const originalPage = figma.currentPage;
const componentSets = [];
const standaloneComponents = [];
let totalVariants = 0;

for (const page of figma.root.children) {
    await figma.setCurrentPageAsync(page);

    // Component Sets (multi-variant components)
    const sets = page.findAllWithCriteria({ types: ['COMPONENT_SET'] });
    for (const cs of sets) {
        const props = Object.entries(cs.componentPropertyDefinitions || {}).map(([key, def]) => {
            const prop = {
                name: key.split('#')[0],  // strip Figma's #id:id suffix for readability
                type: def.type,
                defaultValue: def.defaultValue
            };
            if (def.variantOptions) {
                prop.variantOptions = def.variantOptions;
            }
            return prop;
        });

        componentSets.push({
            id: cs.id,
            name: cs.name,
            pageId: page.id,
            pageName: page.name,
            variantCount: cs.children.length,
            description: cs.description || '',
            properties: props
        });
        totalVariants += cs.children.length;
    }

    // Standalone Components (not inside a component set)
    const comps = page
        .findAllWithCriteria({ types: ['COMPONENT'] })
        .filter(c => c.parent && c.parent.type !== 'COMPONENT_SET');

    for (const comp of comps) {
        standaloneComponents.push({
            id: comp.id,
            name: comp.name,
            pageId: page.id,
            pageName: page.name,
            description: comp.description || ''
        });
    }
}

// Restore original page
await figma.setCurrentPageAsync(originalPage);

return {
    componentSets,
    standaloneComponents,
    summary: {
        setCount: componentSets.length,
        standaloneCount: standaloneComponents.length,
        totalVariants
    }
};