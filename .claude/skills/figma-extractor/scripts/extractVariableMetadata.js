/**
 * extractVariableMetadata
 *
 * Read-only extraction script for the figma-extractor skill (Level 2).
 * Returns all local variable collections with full metadata:
 * modes, codeSyntax, scopes, aliasing chains, and valuesByMode.
 *
 * This data is NOT available through get_variable_defs — that tool
 * returns only a flat map of paths to values without metadata.
 *
 * Usage: embed this entire script in a use_figma call.
 * Always pass skillNames: "figma-extractor" when calling use_figma.
 *
 * IMPORTANT: getLocalVariablesAsync() returns ONLY local variables.
 * If empty, it does NOT mean no variables exist — library variables
 * are invisible to this API. Use search_design_system (Level 3) to
 * check linked libraries before concluding "no tokens".
 *
 * @returns {{
 *   collections: Array<{
 *     id: string,
 *     name: string,
 *     modes: Array<{ modeId: string, name: string }>,
 *     defaultModeId: string,
 *     variableCount: number
 *   }>,
 *   variables: Array<{
 *     id: string,
 *     name: string,
 *     collectionName: string,
 *     collectionId: string,
 *     resolvedType: string,
 *     scopes: string[],
 *     codeSyntax: { WEB?: string, ANDROID?: string, iOS?: string },
 *     valuesByMode: Record<string, any>,
 *     aliases: Array<{ modeName: string, targetName: string, targetId: string }>
 *   }>,
 *   summary: { collectionCount: number, variableCount: number, withCodeSyntax: number, withScopes: number }
 * }}
 */

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const allVars = await figma.variables.getLocalVariablesAsync();

// Build collection lookup
const collMap = {};
for (const coll of collections) {
    collMap[coll.id] = coll;
}

// Build variable ID → name lookup for alias resolution
const varIdToName = {};
for (const v of allVars) {
    varIdToName[v.id] = v.name;
}

const collectionResults = collections.map(c => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name })),
    defaultModeId: c.defaultModeId,
    variableCount: c.variableIds.length
}));

let withCodeSyntax = 0;
let withScopes = 0;

const variableResults = allVars.map(v => {
    const coll = collMap[v.variableCollectionId];
    const modes = coll ? coll.modes : [];

    // Resolve aliases per mode
    const aliases = [];
    const resolvedValues = {};

    for (const mode of modes) {
        const val = v.valuesByMode[mode.modeId];
        if (val && typeof val === 'object' && val.type === 'VARIABLE_ALIAS') {
            const targetName = varIdToName[val.id] || 'unknown';
            aliases.push({ modeName: mode.name, targetName, targetId: val.id });
            resolvedValues[mode.name] = { type: 'ALIAS', target: targetName };
        } else {
            resolvedValues[mode.name] = val;
        }
    }

    if (v.codeSyntax && Object.keys(v.codeSyntax).length > 0) withCodeSyntax++;
    if (v.scopes && v.scopes.length > 0) withScopes++;

    return {
        id: v.id,
        name: v.name,
        collectionName: coll ? coll.name : 'unknown',
        collectionId: v.variableCollectionId,
        resolvedType: v.resolvedType,
        scopes: v.scopes || [],
        codeSyntax: v.codeSyntax || {},
        valuesByMode: resolvedValues,
        aliases
    };
});

return {
    collections: collectionResults,
    variables: variableResults,
    summary: {
        collectionCount: collections.length,
        variableCount: allVars.length,
        withCodeSyntax,
        withScopes
    }
};