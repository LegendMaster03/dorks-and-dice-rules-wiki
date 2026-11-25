import { element } from "./ui.js";
import { renderNativeMonster, renderMonsterDice } from "./native-monster-detail.js";
import * as presentation from "./native-presentation.js";
import { nativeRuleIdentity, ruleRoute } from "./rules-context.js";

const importedCatalogs = new Set(["dnd-5e", "dnd-5-5e"]);
/** The imported records are flat native monsters, not arbitrary kind aliases.
 * The first-party compatibility registration already uses the same statblock.
 * Do not capture incompatible records or unwrap their content in the registry. */
export function supportsImportedCreature(input) {
    const d = input.record;
    return importedCatalogs.has(input.context.rulesetId) && input.rule.kind === "monster"
        && d !== null && typeof d === "object" && !Array.isArray(d)
        && d.kind === "monster" && d.id === input.rule.id
        && typeof d.name === "string" && d.type !== undefined && d.size !== undefined
        && (d.ac !== undefined || d.hp !== undefined || d.speed !== undefined);
}

// The optional named export is the B integration handshake: foundation's
// inert renderer accepts only a value, while B supports input and dice hooks.
function scopedReference(id, input) {
    try {
        nativeRuleIdentity(id);
        const context = input.context;
        if (!input.references || Object.keys(context).some(key => input.references.context?.[key] !== context[key]))
            return element("span", { text: id });
        const href = input.hrefForRule(id), path = ruleRoute(context.rulesetId, id);
        if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")
            || /[\\\s?#]/.test(href) || !href.endsWith(path)) return element("span", { text: id });
        return element("a", { text: id, attributes: { href } });
    } catch { return element("span", { text: id }); }
}

export function renderImportedCreature(input, shared = presentation) {
    const article = element("article", { className: "rules-wiki-monster-article" });
    // Shared generic renderer preserves unknown values as inert DOM. B owns
    // replacing the compatibility inline/entry parser; never infer IDs from tags.
    const contentOptions = { input, inlineClass: "rw-stat-inline", renderDice: renderMonsterDice };
    const fallback = value => shared.renderStructuredContent(value, contentOptions);
    // Once B re-exports its shared inline entry point, use one shared parser
    // for all imported structured content. This remains synchronous and detached.
    if (typeof shared.renderInlineContent === "function") fallback.renderStructured = fallback;
    article.append(renderNativeMonster(input.rule, fallback, { imported: true, explicitSavesOnly: true }));
    const references = Array.isArray(input.record.catalogReferences)
        ? [...new Set(input.record.catalogReferences)].filter(id => typeof id === "string"
            && /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/i.test(id)) : [];
    if (references.length) article.append(element("section", { className: "rw-stat-section" },
        element("h3", { className: "rw-stat-section-title", text: "Catalog References" }),
        element("ul", {}, references.map(id => element("li", {},
            typeof shared.renderStructuredReference === "function"
                ? shared.renderStructuredReference(id, input) : scopedReference(id, input))))));
    article.append(shared.renderNativeAttribution(input));
    return article;
}
export function registerNativeRenderers(registry) {
    registry.register({ id: "creature.imported-dnd", supports: supportsImportedCreature, render: renderImportedCreature });
}
