import { element } from "./ui.js";
import { renderNativeMonster, renderMonsterDice } from "./native-monster-detail.js";
import * as presentation from "./native-presentation.js";
import { DEFAULT_RULESET_ID } from "./rules-context.js";
/** The imported records are flat native monsters, not arbitrary kind aliases.
 * The first-party compatibility registration already uses the same statblock.
 * Do not capture incompatible records or unwrap their content in the registry. */
export function supportsImportedCreature(input) {
    const d = input.record;
    return input.context.rulesetId !== DEFAULT_RULESET_ID && input.rule.kind === "monster"
        && d !== null && typeof d === "object" && !Array.isArray(d)
        && d.kind === "monster" && d.id === input.rule.id && !d.definition
        && typeof d.name === "string" && d.type !== undefined && d.size !== undefined
        && (d.ac !== undefined || d.hp !== undefined || d.speed !== undefined);
}

export function renderImportedCreature(input, shared = presentation) {
    // B prepares references using only explicit native IDs and the pinned reader.
    // No requests are made by fixture-only or unbound callers.
    if (typeof input.references?.resolve === "function") {
        return shared.resolveSourceReferenceIds(input).then(referenceIds => renderCreature(input, shared, referenceIds));
    }
    return renderCreature(input, shared, new Map());
}
function renderCreature(input, shared, referenceIds) {
    const article = element("article", { className: "rules-wiki-monster-article" });
    // Shared renderer preserves unknown values as inert DOM; never infer IDs from tags.
    const contentOptions = { input, inlineClass: "rw-stat-inline", renderDice: renderMonsterDice, referenceIds };
    const fallback = value => shared.renderStructuredContent(value, contentOptions);
    // One shared parser for imported and legacy content; context is view-specific.
    fallback.renderStructured = fallback;
    article.append(renderNativeMonster(input.rule, fallback, { imported: true, explicitSavesOnly: true }));
    const references = Array.isArray(input.record.catalogReferences)
        ? [...new Set(input.record.catalogReferences)].filter(id => typeof id === "string"
            && /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/i.test(id)) : [];
    if (references.length) article.append(element("section", { className: "rw-stat-section" },
        element("h3", { className: "rw-stat-section-title", text: "Catalog References" }),
        element("ul", {}, references.map(id => element("li", {},
            (shared.renderStructuredReference ?? presentation.renderStructuredReference)(id, input))))));
    article.append(shared.renderNativeAttribution(input));
    return article;
}
export function registerNativeRenderers(registry) {
    registry.register({ id: "creature.imported-dnd", supports: supportsImportedCreature, render: renderImportedCreature });
}
