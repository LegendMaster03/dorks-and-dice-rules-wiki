// The existing Wiki browser consumes a presentation model. Every read below uses
// the native API; presentation keys preserve exact native IDs, not legacy IDs.
const RULESET_ID = "first-party-001";
const PAGE_SIZE = 100;
export function installNativeReferenceApi(api) {
    api.getNativeRulesets = () => api.operation("getNativeRulesets");
    api.searchNativeRules = (rulesetId, filters = {}) => api.operation("searchNativeRules", [rulesetId, filters]);
    api.getNativeRule = (rulesetId, id) => api.operation("getNativeRule", [rulesetId, id]);
    return api;
}
export function installWikiReferenceApi(api) {
    installNativeReferenceApi(api);
    api.referenceFacets = { package: [], edition: [] };
    api.getGlobalRulesCatalog = async (filters = {}) => {
        const rulesets = await api.getNativeRulesets();
        const ruleset = rulesets.rulesets?.find(value => value.id === RULESET_ID);
        if (!ruleset) throw new Error("The native ruleset is unavailable.");
        const all = [];
        let fingerprint = ruleset.fingerprint;
        let total;
        do {
            const page = await api.searchNativeRules(RULESET_ID, {
                ...(filters.query ? { q: filters.query } : {}), limit: PAGE_SIZE, offset: all.length
            });
            if (page.rulesetId !== RULESET_ID || typeof page.fingerprint !== "string" || !page.fingerprint) throw new Error("Invalid native catalog identity.");
            if (fingerprint && fingerprint !== page.fingerprint) throw new Error("The native catalog changed during loading. Retry the search.");
            fingerprint = page.fingerprint;
            total = page.total;
            if (!Number.isInteger(total) || total < 0 || !Array.isArray(page.rules)) throw new Error("Invalid native catalog response.");
            if (!page.rules.length && all.length < total) throw new Error("The native catalog load was incomplete.");
            all.push(...page.rules);
        } while (all.length < total);
        const rows = all.map(rule => ({
            nativeId: rule.id, conceptKey: rule.id, referenceIdentity: rule.id,
            browserLink: { toolRelativePath: `/rules/${encodeURIComponent(rule.id)}` },
            displayName: rule.name, entityType: browserCategory(rule.kind),
            effectiveCategory: browserCategory(rule.kind), nativeKind: rule.kind,
            resolutionState: "native", browserFields: [], categoryHistory: []
        }));
        const counts = new Map();
        for (const row of rows) counts.set(row.entityType, (counts.get(row.entityType) ?? 0) + 1);
        const filtered = filters.entityType ? rows.filter(row => row.entityType === filters.entityType) : rows;
        const offset = filters.offset ?? 0;
        return {
            rules: filtered.slice(offset, offset + (filters.limit ?? 25)),
            totalCount: filtered.length, fingerprint, rulesetId: RULESET_ID,
            entityTypeFacets: [...counts].map(([entityType, count]) => ({ entityType, count })),
            sourceFacets: [], revisionNumber: fingerprint, nativeCatalog: true
        };
    };
    api.getWikiReferenceDetail = async (id, campaignId = null) => {
        if (campaignId) throw new Error("Campaign rules are not available in the native Core yet.");
        return { native: await api.getNativeRule(RULESET_ID, id) };
    };
    api.getGlobalResolvedRule = id => api.getWikiReferenceDetail(id);
    return api;
}
function browserCategory(kind) {
    return kind === "leveled-condition" ? "condition" : (kind === "ruleChapter" || kind === "rule-chapter") ? "rule" : kind;
}
export function referenceCategoryMode() { return "effective"; }
export function referenceFacetFilters() { return { package: "", edition: "" }; }
export function isReferenceCatalogSentinel() { return false; }
