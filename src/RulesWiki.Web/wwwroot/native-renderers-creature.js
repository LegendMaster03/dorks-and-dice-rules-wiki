import { element } from "./ui.js";
import { renderNativeMonster } from "./native-monster-detail.js";
import { renderStructuredContent, renderNativeAttribution } from "./native-presentation.js";

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

export function renderImportedCreature(input) {
    const article = element("article", { className: "rules-wiki-monster-article" });
    // Shared generic renderer preserves unknown values as inert DOM. B owns
    // replacing the compatibility inline/entry parser; never infer IDs from tags.
    const fallback = value => renderStructuredContent(value);
    article.append(renderNativeMonster(input.rule, fallback, { imported: true, explicitSavesOnly: true }));
    const references = Array.isArray(input.record.catalogReferences)
        ? [...new Set(input.record.catalogReferences)].filter(id => typeof id === "string"
            && /^[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+$/i.test(id)) : [];
    if (references.length) article.append(element("section", { className: "rw-stat-section" },
        element("h3", { className: "rw-stat-section-title", text: "Catalog References" }),
        element("ul", {}, references.map(id => element("li", {},
            element("a", { text: id, attributes: { href: input.hrefForRule(id) } }))))));
    article.append(renderNativeAttribution(input));
    return article;
}
export function registerNativeRenderers(registry) {
    registry.register({ id: "creature.imported-dnd", supports: supportsImportedCreature, render: renderImportedCreature });
}
