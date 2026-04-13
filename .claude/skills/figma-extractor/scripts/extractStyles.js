/**
 * extractStyles
 *
 * Read-only extraction script for the figma-extractor skill (Level 2).
 * Returns all local text styles, effect styles, and paint styles
 * with their full property definitions.
 *
 * This data is NOT available through get_variable_defs or get_design_context.
 * get_design_context partially infers styles from usage but misses style names,
 * exact letterSpacing, and multi-shadow effect definitions.
 *
 * Usage: embed this entire script in a use_figma call.
 * Always pass skillNames: "figma-extractor" when calling use_figma.
 *
 * @returns {{
 *   textStyles: Array<{
 *     id: string, name: string, fontFamily: string, fontStyle: string,
 *     fontSize: number, lineHeight: { value: number, unit: string } | string,
 *     letterSpacing: { value: number, unit: string },
 *     textCase: string, textDecoration: string
 *   }>,
 *   effectStyles: Array<{
 *     id: string, name: string,
 *     effects: Array<{
 *       type: string, visible: boolean,
 *       color?: { r: number, g: number, b: number, a: number },
 *       offset?: { x: number, y: number },
 *       radius?: number, spread?: number
 *     }>
 *   }>,
 *   paintStyles: Array<{
 *     id: string, name: string,
 *     paints: Array<{
 *       type: string, visible: boolean, opacity: number,
 *       color?: { r: number, g: number, b: number }
 *     }>
 *   }>,
 *   summary: { textCount: number, effectCount: number, paintCount: number }
 * }}
 */

const [textStyles, effectStyles, paintStyles] = await Promise.all([
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalPaintStylesAsync()
]);

const textResults = textStyles.map(s => ({
    id: s.id,
    name: s.name,
    fontFamily: s.fontName.family,
    fontStyle: s.fontName.style,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textCase: s.textCase || 'ORIGINAL',
    textDecoration: s.textDecoration || 'NONE'
}));

const effectResults = effectStyles.map(s => ({
    id: s.id,
    name: s.name,
    effects: s.effects.map(e => {
        const result = { type: e.type, visible: e.visible };
        if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
            result.color = {
                r: e.color.r,
                g: e.color.g,
                b: e.color.b,
                a: e.color.a
            };
            result.offset = e.offset;
            result.radius = e.radius;
            result.spread = e.spread;
        }
        if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') {
            result.radius = e.radius;
        }
        return result;
    })
}));

const paintResults = paintStyles.map(s => ({
    id: s.id,
    name: s.name,
    paints: s.paints.map(p => {
        const result = { type: p.type, visible: p.visible !== false };
        if (p.type === 'SOLID') {
            result.color = { r: p.color.r, g: p.color.g, b: p.color.b };
            result.opacity = p.opacity !== undefined ? p.opacity : 1;
        }
        return result;
    })
}));

return {
    textStyles: textResults,
    effectStyles: effectResults,
    paintStyles: paintResults,
    summary: {
        textCount: textStyles.length,
        effectCount: effectStyles.length,
        paintCount: paintStyles.length
    }
};