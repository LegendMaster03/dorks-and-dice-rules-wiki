/** Construct Assembly is a reference workspace, not an assembly evaluator.
 * B owns the mounted index/detail lifecycle and navigation. This adapter supplies
 * bounded index data and detached detail nodes using A's pinned reader.
 */
import { DEFAULT_RULESET_ID, assertSnapshot, categoryRoute, nativeRuleIdentity } from "./rules-context.js";
import { renderStructuredContent, renderStructuredReference, renderNativeAttribution } from "./native-presentation.js";
import { humanizeKey } from "./rule-renderer-support.js";

export const CONSTRUCT_TABS = Object.freeze([
    ["construct-component", "Components"],
    ["construct-design", "Designs"],
    ["construct-enhancement", "Enhancements"],
    ["construct-material", "Materials"],
    ["construct-power-source", "Power Sources"],
    ["crafting-recipe", "Recipes"]
].map(([kind, label]) => Object.freeze({ kind, label })));
const kinds = new Set([...CONSTRUCT_TABS.map(tab => tab.kind), "crafting-material"]);
const options = new Set(CONSTRUCT_TABS.slice(1).map(tab => tab.kind));
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const available = reader => reader?.context?.rulesetId === DEFAULT_RULESET_ID &&
    reader.originReferenceContractVersion === 1 && reader.context.campaignId == null;
const current = lease => !lease || lease.isCurrent();
const requireReader = reader => {
    if (!available(reader)) throw new Error("Construct Assembly reference contract is unavailable.");
};
const compare = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

/** One complete-family operation per selected tab; no detail fan-out.
 * Missing categories are a contract error, not inferred from a path or label.
 * The owning surface must use its existing lease and qualified routing.
 */
export async function loadConstructIndex(reader, kind, lease) {
    requireReader(reader);
    if (!CONSTRUCT_TABS.some(tab => tab.kind === kind)) throw new Error("Invalid Construct Assembly tab.");
    if (!current(lease)) return null;
    try {
        const family = kind === "construct-component" ? "construct-components" : "construct-options";
        const response = assertSnapshot(reader.context, await reader.originHierarchy(family));
        if (!current(lease)) return null;
        if (response.complete !== true || response.family !== family || !Array.isArray(response.rows))
            throw new Error("Incomplete Construct Assembly family.");
        const rows = response.rows.filter(row => row.kind === kind).sort(compare);
        const groups = new Map();
        for (const row of rows) {
            const category = kind === "construct-component" ? row.componentCategory : kind;
            if (typeof category !== "string" || !category.trim())
                throw new Error("Construct component category is unavailable.");
            if (!groups.has(category)) groups.set(category, []);
            groups.get(category).push(row);
        }
        return { kind, rows, groups: [...groups].sort(([a], [b]) => a.localeCompare(b))
            .map(([category, rows]) => ({ category, rows })) };
    } catch (error) {
        if (!current(lease)) return null;
        throw error;
    }
}

const node = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = String(text);
    if (className) result.className = className;
    return result;
};
export function renderConstructNavigation(reader, selectedKind, toolBasePath = "") {
    requireReader(reader);
    const nav = node("nav", undefined, "d-flex flex-wrap gap-2 mb-3");
    nav.setAttribute("aria-label", "Construct Assembly reference categories");
    for (const tab of CONSTRUCT_TABS) {
        const link = node("a", tab.label, "btn btn-sm btn-outline-secondary");
        link.href = toolBasePath.replace(/\/$/, "") + categoryRoute(reader.context.rulesetId, tab.kind);
        if (tab.kind === selectedKind) link.setAttribute("aria-current", "page");
        nav.append(link);
    }
    return nav;
}

const explicitKeys = new Set(["craftingRecipeId", "recipeId", "defaultRecipeId", "producesDefinitionId",
    "competencyId", "materialId", "operationalOriginTraitIds"]);
const validId = id => {
    try { nativeRuleIdentity(id); return true; } catch { return false; }
};
const reference = (input, id, label = id) => validId(id)
    ? renderStructuredReference(id, input, label)
    : renderStructuredContent(label, { input });

/** Keep authored stage order, dependencies, quantities, and unknown nested
 * fields. Only schema-declared native references receive qualified links.
 * Local variant IDs, capability strings and stage IDs remain ordinary text.
 */
function renderValue(input, value, key = "") {
    if (explicitKeys.has(key) && typeof value === "string") return reference(input, value);
    if (Array.isArray(value)) {
        const list = node("ol", undefined, "mb-2");
        for (const entry of value) {
            const item = node("li");
            item.append(renderValue(input, entry, key));
            list.append(item);
        }
        if (!value.length) return renderStructuredContent("None listed.", { input });
        return list;
    }
    if (object(value)) {
        const fields = node("dl", undefined, "mb-2");
        for (const [field, entry] of Object.entries(value)) {
            const name = field === "reviewNotes" ? "Historical review notes (not operative rules)" : humanizeKey(field);
            fields.append(node("dt", name));
            const detail = node("dd");
            detail.append(renderValue(input, entry, field));
            fields.append(detail);
        }
        return fields;
    }
    if (value === null) return node("span", "Not specified");
    return renderStructuredContent(value, { input });
}
function section(article, heading, body) {
    if (!body) return;
    const part = node("section", undefined, "rules-core-structured-section mb-3");
    part.append(node("h3", heading, "h5"), body);
    article.append(part);
}
function linkedRows(input, rows) {
    if (!rows.length) return node("p", "None listed.");
    const list = node("ul");
    for (const row of rows) {
        const li = node("li");
        li.append(reference(input, row.id ?? row.sourceId, row.name ?? row.id ?? row.sourceId));
        if (row.relation) li.append(document.createTextNode(" — " + humanizeKey(row.relation)));
        list.append(li);
    }
    return list;
}

const groupsByKind = {
    "construct-component": [
        ["Capabilities and requirements", ["provides", "requiresAnyOf", "mountInterfaces", "acceptsMountInterfaces", "powerSourceSlot"]],
        ["Construction", ["materialSlots", "constructionVariants", "craftingRecipeId"]],
        ["Operation", ["powerDemand", "sharesLoadSupport", "definesBodySize", "requiresContinuousPower",
            "operatingModes", "modes", "functionalProperties", "operationalOriginTraitIds"]]
    ],
    "construct-design": [
        ["Applicable capabilities and effects", ["compatibleComponentCapabilities", "provides", "requiresAnyOf", "requirements", "effects"]],
        ["Power and manufacturing", ["powerDemand", "craftingRecipeId", "operationalOriginTraitIds"]]
    ],
    "construct-enhancement": [
        ["Applicable capabilities and effects", ["compatibleComponentCapabilities", "provides", "requiresAnyOf", "requirements", "effects"]],
        ["Power and manufacturing", ["powerDemand", "craftingRecipeId", "operationalOriginTraitIds"]]
    ],
    "construct-material": [["Physical profile", ["physicalProfile", "massPoundsPerUnit"]]],
    "crafting-material": [["Physical profile", ["physicalProfile", "massPoundsPerUnit"]]],
    "construct-power-source": [
        ["Generation and output", ["operatingPrinciple", "powerOutput", "solarCollectionPower", "operatingPolicy"]],
        ["Overdrive and empowerment", ["overdrivePowerOutput", "overdriveIncreasePercent", "overdriveCondition",
            "overdriveFuelUsePolicy", "infernalEmpowerment"]],
        ["Storage, sustenance and shortage", ["storageCapacityPowerUnitHours", "storageResourceKind", "storagePolicy",
            "captureRangeFeet", "captureTrigger", "capturePolicy", "energyAvailabilityPolicy", "consumptionRatePolicy",
            "dailySustenance", "longRestSustenance", "energyShortagePolicy", "fuelShortagePolicy", "overheatingConsequencesStatus"]],
        ["Compatibility and manufacturing", ["compatibleComponentCapabilities", "craftingRecipeId", "operationalOriginTraitIds"]]
    ],
    "crafting-recipe": [
        ["Manufacturing output", ["producesDefinitionId"]],
        ["Recipe stages", ["stages"]],
        ["Mass accounting", ["physicalMassAccounting"]]
    ]
};

function authoredDetail(input, record, category) {
    const article = node("article", undefined, "card card-body mb-3 native-reference-article");
    article.append(node("h2", input.rule.name));
    if (category) article.append(node("p", humanizeKey(category)));
    const used = new Set(["id", "kind", "name", "source", "sourcePackage", "componentCategory", "description", "status", "rulesStatus", "reviewNotes"]);
    for (const key of ["status", "rulesStatus"]) {
        if (Object.hasOwn(record, key)) section(article, humanizeKey(key), renderValue(input, record[key], key));
    }
    if (Object.hasOwn(record, "description")) section(article, "Description", renderValue(input, record.description));
    for (const [heading, keys] of groupsByKind[input.rule.kind]) {
        const fields = Object.fromEntries(keys.filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]]));
        keys.forEach(key => used.add(key));
        if (Object.keys(fields).length) section(article, heading, renderValue(input, fields));
    }
    const remaining = Object.fromEntries(Object.entries(record).filter(([key]) => !used.has(key)));
    if (Object.keys(remaining).length) section(article, "Additional authored fields", renderValue(input, remaining));
    if (Object.hasOwn(record, "reviewNotes"))
        section(article, "Historical review notes (not operative rules)", renderValue(input, record.reviewNotes));
    return article;
}

function appendConfiguration(article, input, projection) {
    const cfg = projection.configuration;
    section(article, "Configuration discovery", node("p",
        "These are Core-discovered reference options, not a valid installation or an assembly calculation."));
    for (const [label, rows] of [
        ["Compatible designs", cfg.designs], ["Compatible enhancements", cfg.enhancements],
        ["Compatible power sources", cfg.powerSources], ["Manufacturing recipes", projection.recipes],
        ["Material assignment candidates", projection.materialAssignmentOptions]
    ]) section(article, label, linkedRows(input, rows ?? []));
    if (projection.materialCompatibilityAvailable === false)
        section(article, "Material suitability", node("p", "Physical suitability and load support are not established by these assignment candidates."));
    const omitted = new Set(["definitionId", "name", "designs", "enhancements", "powerSources", "issues"]);
    const remaining = Object.fromEntries(Object.entries(cfg).filter(([key]) => !omitted.has(key)));
    if (Object.keys(remaining).length) section(article, "Discovered configuration requirements", renderValue(input, remaining));
    if (cfg.issues?.length) section(article, "Configuration discovery issues", renderValue(input, cfg.issues));
}

function appendReverse(article, input, projection) {
    const byRelation = new Map();
    for (const row of projection.sources) {
        if (!byRelation.has(row.relation)) byRelation.set(row.relation, []);
        byRelation.get(row.relation).push(row);
    }
    for (const [relation, rows] of byRelation) section(article, humanizeKey(relation), linkedRows(input, rows));
    if (projection.output) section(article, "Recipe output reference", linkedRows(input, [projection.output]));
    if (projection.recipes.length) section(article, "Recipes producing this record", linkedRows(input, projection.recipes));
    if (input.rule.kind === "construct-material") section(article, "Recipe input references",
        node("p", "Core does not yet provide reverse recipe-input relationships for this material. Assignment candidates do not establish physical suitability."));
}
export function supportsConstructReference(input) {
    return input.context.rulesetId === DEFAULT_RULESET_ID && available(input.references) &&
        kinds.has(input.rule.kind) && object(input.record) &&
        (input.record.id === undefined || input.record.id === input.rule.id) &&
        (input.record.kind === undefined || input.record.kind === input.rule.kind);
}
export async function renderConstructReference(input) {
    if (!supportsConstructReference(input)) throw new Error("Unsupported Construct Assembly reference.");
    const reader = input.references;
    const lease = input.lifecycle;
    if (!current(lease)) return null;
    const record = input.record.id === input.rule.id && object(input.record.definition)
        ? input.record.definition : input.record;
    let projection = null;
    try {
        if (input.rule.kind === "construct-component")
            projection = await reader.originComponent(input.rule.id);
        else if (options.has(input.rule.kind))
            projection = await reader.originComponentSources(input.rule.id);
        if (!current(lease)) return null;
    } catch (error) {
        if (!current(lease)) return null;
        throw error;
    }
    if (projection) assertSnapshot(input.context, projection);
    // Selected component's authoritative loader-projected definition supplies
    // path-identified identity and category. The original reader record is retained.
    const authored = projection && input.rule.kind === "construct-component" ? projection.definition : record;
    const article = authoredDetail(input, authored, projection?.componentCategory ?? null);
    if (input.rule.kind === "construct-component") appendConfiguration(article, input, projection);
    else if (projection) appendReverse(article, input, projection);
    else if (input.rule.kind === "crafting-material") section(article, "Recipe input references",
        node("p", "Core does not yet provide reverse recipe-input relationships for crafting ingredients."));
    if (record !== authored) {
        const extra = Object.fromEntries(Object.entries(record).filter(([key]) => !Object.hasOwn(authored, key)
            && !["source", "sourcePackage", "reviewNotes"].includes(key)));
        if (Object.keys(extra).length) section(article, "Additional record fields", renderValue(input, extra));
    }
    if (record !== input.record) {
        const wrapper = Object.fromEntries(Object.entries(input.record)
            .filter(([key]) => !["id", "kind", "name", "source", "sourcePackage", "definition"].includes(key)));
        if (Object.keys(wrapper).length) section(article, "Record context", renderValue(input, wrapper));
    }
    article.append(renderNativeAttribution(input));
    return article;
}

export function registerConstructRenderers(registry) {
    registry.register({ id: "origin.construct-reference", priority: 40,
        supports: supportsConstructReference, render: renderConstructReference });
}
