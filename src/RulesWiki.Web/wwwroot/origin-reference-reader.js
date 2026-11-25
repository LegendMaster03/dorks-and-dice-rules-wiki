/** First-party reference-only reads. The server retains authorization authority. */
import { DEFAULT_RULESET_ID, assertSnapshot, nativeRuleIdentity } from "./rules-context.js";
const families = new Set(["biological", "upbringing", "construct-components"]);
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
    const validRow = row => {
        try { nativeRuleIdentity(row?.id); } catch { return false; }
        return typeof row.name === "string" && !!row.name.trim() && typeof row.kind === "string";
    };
    return {
        originReferenceContractVersion: supported ? 1 : null,
        async originHierarchy(family) {
            if (!families.has(family)) throw new Error("Invalid Origin reference family.");
            return read("getNativeOriginHierarchy", family, "family", r =>
                r.complete === true && Array.isArray(r.rows) && r.rows.length <= 256 &&
                r.rows.every(validRow) && new Set(r.rows.map(row => row.id)).size === r.rows.length);
        },
        async originSource(id) {
            nativeRuleIdentity(id);
            return read("getNativeOriginSource", id, "sourceId", r =>
                Array.isArray(r.lineage) && r.lineage.length > 0 && r.lineage.length <= 64 &&
                r.lineage.at(-1)?.id === id && r.lineage.every(row => validRow(row) &&
                    row.definition?.id === row.id && Array.isArray(row.traitOccurrences)) &&
                new Set(r.lineage.map(row => row.id)).size === r.lineage.length);
        },
        async originTraitSources(id) {
            nativeRuleIdentity(id);
            return read("getNativeOriginTraitSources", id, "traitId", r =>
                r.complete === true && Array.isArray(r.sources) && r.sources.every(row => {
                    try { nativeRuleIdentity(row.sourceId); } catch { return false; }
                    return typeof row.path === "string" && ["biological-occurrence",
                        "construct-operational-reference"].includes(row.relation);
                }));
        },
        async originComponent(id) {
            nativeRuleIdentity(id);
            return read("getNativeOriginComponent", id, "componentId", r =>
                r.definition?.id === id && r.configuration?.definitionId === id &&
                Array.isArray(r.recipes));
        }
    };
}
