// The existing Wiki browser consumes a presentation model. Every read below uses
// the native API; presentation keys preserve exact native IDs, not legacy IDs.
// Adapt native Core records to the existing browser's presentation shape;
// retain authoritative native rule IDs and ruleset fingerprints.
import { packageDescriptor } from "./package-attribution.js";
import { DEFAULT_RULESET_ID, assertSnapshot, requireBaseContext, nativeRuleIdentity, referenceKey, ruleRoute } from "./rules-context.js";
const RULESET_ID = "first-party-001";
const PAGE_SIZE = 100;
export function installNativeReferenceApi(api) {
    api.getNativeRulesets = async () => {
        const response = await api.operation("getNativeRulesets");
        api.lastNativeRulesets = response;
        return response;
    };
    api.searchNativeRules = (rulesetId, filters = {}) => api.operation("searchNativeRules", [rulesetId, filters]);
    api.getNativeRule = (rulesetId, id) => api.operation("getNativeRule", [rulesetId, id]);
    return api;
}
export function installWikiReferenceApi(api) {
    installNativeReferenceApi(api);
    api.referenceFacets = { package: [], edition: [] };
    api.getGlobalRulesCatalog = async (filters = {}, reader = null) => {
        if (reader) return readNativeCatalogPage(reader, filters);
        const rulesets = await api.getNativeRulesets();
        const ruleset = rulesets.rulesets?.find(value => value.id === RULESET_ID);
        if (!ruleset) throw new Error("The native ruleset is unavailable.");
        const all = [];
        let fingerprint = ruleset.fingerprint;
        let total;
        // A catalog read must not mix pages from different Core fingerprints.
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
        // Links and detail lookup use native IDs, not legacy concept mappings.
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
            packageDescriptor: packageDescriptor({ rulesetId: RULESET_ID, fingerprint }, ruleset),
            entityTypeFacets: [...counts].map(([entityType, count]) => ({ entityType, count })),
            sourceFacets: [], revisionNumber: fingerprint, nativeCatalog: true
        };
    };
    api.getWikiReferenceDetail = async (id, campaignId = null, reader = null) => {
        if (campaignId) throw new Error("Campaign rules are not available in the native Core yet.");
        return { native: reader ? await reader.resolve(id) : await api.getNativeRule(RULESET_ID, id) };
    };
    api.getGlobalResolvedRule = (id, reader = null) => api.getWikiReferenceDetail(id, null, reader);
    return api;
}
function browserCategory(kind) {
    return kind === "leveled-condition" ? "condition" : (kind === "ruleChapter" || kind === "rule-chapter") ? "rule" : kind;
}

// Bounded page adapter for the authorized reader. All rows preserve their
// native identity; the qualified identity is only for cross-catalog state.
export function authorizedRulesetDescriptors(response) {
    const descriptors = Array.isArray(response?.rulesets) ? response.rulesets : [];
    return descriptors.flatMap(entry => {
        try {
            if (descriptors.filter(other => other?.id === entry?.id).length !== 1) return [];
            const descriptor = packageDescriptor({ rulesetId: entry.id, fingerprint: entry.fingerprint }, entry);
            return descriptor ? [descriptor] : [];
        } catch { return []; }
    });
}

function nativeBrowserCategory(kind, rulesetId) {
    return rulesetId === DEFAULT_RULESET_ID ? browserCategory(kind) : kind;
}

function nativeCategoryKinds(category, rulesetId) {
    if (!category || rulesetId !== DEFAULT_RULESET_ID) return [category];
    if (category === "condition") return ["condition", "leveled-condition"];
    if (category === "rule") return ["rule", "ruleChapter", "rule-chapter"];
    return [category];
}

/** Fetch one page, not the complete result set. First-party legacy category
 * families concatenate a fixed number of native category streams. The page
 * response supplies the exact matching total for each stream. */
export async function readNativeCatalogPage(reader, filters = {}) {
    if (!reader?.context) throw new Error("An authorized ruleset reader is required.");
    const context = requireBaseContext(reader.context);
    const { rulesetId, fingerprint } = context;
    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;
    if (!Number.isInteger(limit) || limit < 1 || limit > PAGE_SIZE ||
        !Number.isInteger(offset) || offset < 0 || offset > 1000000)
        throw new Error("Invalid native browser page.");
    if (filters.sourceCode || filters.overridesOnly || Object.keys(filters.fieldFilters ?? {}).length)
        throw new Error("The native catalog does not support these filters.");
    const q = String(filters.query ?? "").trim();
    if (q.length > 200) throw new Error("Native search exceeds the permitted length.");
    const rows = [], facets = new Map(), ids = new Set();
    let total = 0, first = true;
    for (const category of nativeCategoryKinds(filters.entityType || null, rulesetId)) {
        const remaining = limit - rows.length;
        const relativeOffset = Math.max(0, offset - total);
        const requestedLimit = Math.max(1, remaining);
        const page = assertSnapshot(context, await reader.search({
            ...(q ? { q } : {}), ...(category ? { category } : {}),
            limit: requestedLimit, offset: relativeOffset
        }));
        if (!Number.isInteger(page.total) || page.total < 0 ||
            page.offset !== relativeOffset || page.limit !== requestedLimit ||
            !Array.isArray(page.rules) ||
            page.rules.length !== Math.min(requestedLimit, Math.max(0, page.total - relativeOffset)) ||
            !Array.isArray(page.categoryFacets))
            throw new Error("Invalid native catalog page.");
        if (first) {
            for (const facet of page.categoryFacets) {
                if (typeof facet.kind !== "string" || !/^[a-zA-Z][a-zA-Z0-9-]{0,79}$/.test(facet.kind) ||
                    !Number.isInteger(facet.count) || facet.count < 0)
                    throw new Error("Invalid native category facet.");
                const kind = nativeBrowserCategory(facet.kind, rulesetId);
                facets.set(kind, (facets.get(kind) ?? 0) + facet.count);
            }
            first = false;
        }
        for (const rule of page.rules.slice(0, remaining)) {
            nativeRuleIdentity(rule.id);
            if (ids.has(rule.id) || typeof rule.name !== "string" || !rule.name.trim() ||
                typeof rule.kind !== "string" || !/^[a-zA-Z][a-zA-Z0-9-]{0,79}$/.test(rule.kind) ||
                (category && rule.kind.toLowerCase() !== category.toLowerCase()))
                throw new Error("Invalid native catalog row.");
            ids.add(rule.id);
            const entityType = nativeBrowserCategory(rule.kind, rulesetId);
            rows.push({
                nativeId: rule.id, conceptKey: rule.id, referenceIdentity: rule.id,
                qualifiedIdentity: referenceKey(rulesetId, rule.id),
                browserLink: { toolRelativePath: ruleRoute(rulesetId, rule.id) },
                displayName: rule.name, entityType, effectiveCategory: entityType, nativeKind: rule.kind,
                resolutionState: "native", browserFields: [], categoryHistory: []
            });
        }
        total += page.total;
    }
    return {
        rules: rows, totalCount: total, fingerprint, rulesetId,
        packageDescriptor: reader.packageDescriptor,
        entityTypeFacets: [...facets].map(([entityType, count]) => ({ entityType, count })),
        sourceFacets: [], revisionNumber: fingerprint, nativeCatalog: true
    };
}

export function referenceCategoryMode() { return "effective"; }
export function referenceFacetFilters() { return { package: "", edition: "" }; }
export function isReferenceCatalogSentinel() { return false; }
