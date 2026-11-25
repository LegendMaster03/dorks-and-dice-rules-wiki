/** First-party reference-only reads. The server retains authorization authority. */
import { DEFAULT_RULESET_ID, assertSnapshot, nativeRuleIdentity } from "./rules-context.js";
const families = new Set(["biological", "upbringing", "construct-components", "characteristics", "backgrounds", "construct-options"]);
export function createOriginReferenceReader(api, context, descriptor) {
    const supported = context.rulesetId === DEFAULT_RULESET_ID &&
        descriptor?.capabilities?.originReferenceContractVersion === 1;
    async function read(operation, target, identityField, validate) {
        if (!supported) throw new Error("Origin reference contract is unavailable for this reader.");
        const response = assertSnapshot(context, await api[operation](
            context.rulesetId, context.fingerprint, target));
        if (response.contractVersion !== 1 || response[identityField] !== target || !validate(response))
            throw new Error("Invalid Origin reference projection.");
        return response;
    }
    const validId = id => {
        try { nativeRuleIdentity(id); return true; } catch { return false; }
    };
    const validRow = row => {
        try { nativeRuleIdentity(row?.id); } catch { return false; }
        return typeof row.name === "string" && !!row.name.trim() && typeof row.kind === "string";
    };
    const familyKinds = {
        biological: ["species", "ancestry"],
        upbringing: ["upbringing"],
        backgrounds: ["background"],
        characteristics: ["origin-trait"],
        "construct-components": ["construct-component"],
        "construct-options": ["construct-design", "construct-enhancement", "construct-material", "construct-power-source", "crafting-recipe"]
    };
    const validHierarchy = (family, response) => {
        const rows = response.rows;
        if (response.complete !== true || !Array.isArray(rows) || rows.length > 256 ||
            !rows.every(row => validRow(row) && familyKinds[family].includes(row.kind))) return false;
        const ids = new Set(rows.map(row => row.id));
        return ids.size === rows.length && rows.every(row => row.parentId == null ||
            (validId(row.parentId) && row.parentId !== row.id && ids.has(row.parentId)));
    };
    // Validate the identity of each occurrence against its source-qualified
    // pointer. This is reference validation, not a second inheritance resolver.
    const validOccurrence = (row, occurrence, index) =>
        occurrence?.sourceId === row.id && occurrence.index === index &&
        occurrence.path === "/traits/" + index &&
        (occurrence.canonicalTraitId == null ||
            (validId(occurrence.canonicalTraitId) && occurrence.canonicalTraitId.startsWith("trait."))) &&
        occurrence.trait != null && typeof occurrence.trait === "object" &&
        occurrence.localId === (occurrence.trait.id ?? null) &&
        row.definition.traits?.[index]?.id === occurrence.trait.id;
    const validLineage = (id, response) => {
        const chain = response.lineage;
        if (!Array.isArray(chain) || chain.length < 1 || chain.length > 64 ||
            chain.at(-1)?.id !== id) return false;
        const sourceIds = new Set(chain.map(row => row?.id));
        if (sourceIds.size !== chain.length || !chain.every((row, index) => validRow(row) &&
            row.definition?.id === row.id && row.definition?.kind === row.kind &&
            ["species", "ancestry", "upbringing"].includes(row.kind) &&
            row.inheritedSource === (row.id !== id) &&
            (index === 0 ? row.definition.parent == null : row.definition.parent === chain[index - 1].id) &&
            Array.isArray(row.traitOccurrences) &&
            row.traitOccurrences.length === (["species", "ancestry"].includes(row.kind) ? (row.definition.traits?.length ?? 0) : 0) &&
            row.traitOccurrences.every((occurrence, i) => validOccurrence(row, occurrence, i)))) return false;
        const direct = response.directReference;
        const validOffer = offer => sourceIds.has(offer?.sourceId) &&
            typeof offer.path === "string" && offer.path.startsWith("/");
        return direct == null || (direct.referenceOnly === true &&
            Array.isArray(direct.candidates) && direct.candidates.every(validOffer) &&
            Array.isArray(direct.fixedValues) && direct.fixedValues.every(validOffer));
    };
    return {
        originReferenceContractVersion: supported ? 1 : null,
        async originHierarchy(family) {
            if (!families.has(family)) throw new Error("Invalid Origin reference family.");
            return read("getNativeOriginHierarchy", family, "family", r => validHierarchy(family, r));
        },
        async originSource(id) {
            nativeRuleIdentity(id);
            return read("getNativeOriginSource", id, "sourceId", r => validLineage(id, r));
        },
        async originTraitSources(id) {
            nativeRuleIdentity(id);
            return read("getNativeOriginTraitSources", id, "traitId", r =>
                r.complete === true && Array.isArray(r.sources) && r.sources.every(row => {
                    try { nativeRuleIdentity(row.sourceId); } catch { return false; }
                    return typeof row.path === "string" && (row.relation === "biological-occurrence"
                        ? ["species", "ancestry"].includes(row.kind) && /^\\/traits\\/\\d+$/.test(row.path)
                        : row.relation === "construct-operational-reference" && row.kind.startsWith("construct-") &&
                            /^\\/operationalOriginTraitIds\\/\\d+$/.test(row.path));
                }));
        },
        async originMethods(scope = "all") {
            if (scope !== "all" && (!nativeRuleIdentity(scope).startsWith("creature-type.")))
                throw new Error("Invalid creature-type reference scope.");
            return read("getNativeOriginMethods", scope, "scope", r =>
                r.previewOnly === true && Array.isArray(r.methods) &&
                r.methods.every(m => m.reference?.ruleId === "rule.creature-origination" &&
                    typeof m.reference.methodId === "string" && !!m.reference.methodId));
        },
        async originComponentSources(id) {
            nativeRuleIdentity(id);
            return read("getNativeOriginComponentSources", id, "targetId", r =>
                r.complete === true && Array.isArray(r.sources) && Array.isArray(r.recipes) &&
                r.sources.every(row => {
                    try { nativeRuleIdentity(row.sourceId); } catch { return false; }
                    return typeof row.path === "string" && ["compatible-design", "compatible-enhancement",
                        "compatible-power-source", "material-assignment-candidate", "default-recipe",
                        "variant-recipe"].includes(row.relation);
                }));
        },
        async originComponent(id) {
            nativeRuleIdentity(id);
            return read("getNativeOriginComponent", id, "componentId", r =>
                r.definition?.id === id && r.configuration?.definitionId === id &&
                Array.isArray(r.recipes) && r.recipes.every(recipe => validId(recipe.id)) &&
                Array.isArray(r.materialAssignmentOptions) && r.materialAssignmentOptions.every(option => validId(option.id)));
        }
    };
}
