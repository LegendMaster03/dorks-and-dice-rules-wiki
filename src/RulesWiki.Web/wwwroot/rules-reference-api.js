import { registerClassFamilyAdvancementMetadata } from "./class-family-model.js";

const REFERENCE_CATALOG_SENTINEL = "reference-catalog";
const REFERENCE_PREFETCH_TTL_MS = 15_000;

export function installWikiReferenceApi(api) {
    api.referenceFacets = { package: [], edition: [] };

    const catalogPrefetches = new Map();
    const detailPrefetches = new Map();

    api.prefetchGlobalRulesCatalog = filters =>
        prefetchCatalog(api, catalogPrefetches, null, filters);
    api.prefetchCampaignRulesCatalog = (campaignId, filters) =>
        prefetchCatalog(api, catalogPrefetches, campaignId, filters);
    api.getGlobalRulesCatalog = filters =>
        getCatalog(api, catalogPrefetches, null, filters);
    api.getCampaignRulesCatalog = (campaignId, filters) =>
        getCatalog(api, catalogPrefetches, campaignId, filters);

    api.prefetchWikiReferenceDetail = (referenceIdentity, campaignId = null) =>
        prefetchReferenceDetail(api, detailPrefetches, referenceIdentity, campaignId);
    api.getWikiReferenceDetail = (referenceIdentity, campaignId = null) =>
        getReferenceDetail(api, detailPrefetches, referenceIdentity, campaignId);

    api.getClassFamilyRelations = (referenceIdentity, campaignId = null) =>
        api.backend(campaignId
            ? `/api/campaigns/${encodeURIComponent(campaignId)}/wiki/references/${encodeURIComponent(referenceIdentity)}/class-family`
            : `/api/wiki/references/${encodeURIComponent(referenceIdentity)}/class-family`);

    api.getGlobalResolvedRule = async referenceIdentity =>
        projectEffectiveReference(await api.getWikiReferenceDetail(referenceIdentity));
    api.getCampaignResolvedRule = async (campaignId, referenceIdentity) =>
        projectEffectiveReference(await api.getWikiReferenceDetail(referenceIdentity, campaignId));
    api.getRuleVersions = async referenceIdentity =>
        projectReferenceVersions(await api.getWikiReferenceDetail(referenceIdentity));
    api.compareRuleVersions = payload => api.backend("/api/wiki/references/comparison", {
        method: "POST",
        body: {
            referenceIdentity: payload.referenceIdentity ?? payload.ruleConceptId,
            leftSourceEntityRevisionId: payload.leftSourceEntityRevisionId,
            rightSourceEntityRevisionId: payload.rightSourceEntityRevisionId
        }
    });
}

function getCatalog(api, prefetches, campaignId, filters = {}) {
    const request = buildCatalogRequest(campaignId, filters);
    return consumePrefetch(prefetches, request.key)
        ?? requestCatalog(api, request);
}

function prefetchCatalog(api, prefetches, campaignId, filters = {}) {
    const request = buildCatalogRequest(campaignId, filters);
    return createPrefetch(
        prefetches,
        request.key,
        () => requestCatalog(api, request));
}

function buildCatalogRequest(campaignId, filters = {}) {
    const parameters = new URLSearchParams();
    const routedFacets = referenceFacetFilters();
    const offset = Math.max(0, filters.offset ?? 0);
    if (filters.entityType) parameters.set("entityType", filters.entityType);
    if (filters.query) parameters.set("q", filters.query);
    if (filters.sourceCode) parameters.set("source", filters.sourceCode);
    if (filters.packageKey ?? routedFacets.package) parameters.set("package", filters.packageKey ?? routedFacets.package);
    if (filters.edition ?? routedFacets.edition) parameters.set("edition", filters.edition ?? routedFacets.edition);
    if (campaignId && filters.overridesOnly) parameters.set("overridesOnly", "true");
    parameters.set("categoryMode", referenceCategoryMode());
    parameters.set("limit", String(filters.limit ?? 200));
    parameters.set("offset", String(offset));

    const path = campaignId
        ? `/api/campaigns/${encodeURIComponent(campaignId)}/wiki/references`
        : "/api/wiki/references";
    const requestPath = `${path}?${parameters.toString()}`;
    return {
        key: requestPath,
        offset,
        requestPath
    };
}

function requestCatalog(api, request) {
    return api.backend(request.requestPath).then(catalog => {
        if (request.offset === 0) {
            api.referenceFacets = {
                package: projectFacetOptions(catalog.packageFacets),
                edition: projectFacetOptions(catalog.editionFacets)
            };
            api.onReferenceFacetsChanged?.(api.referenceFacets);
        }
        return projectReferenceCatalog(catalog);
    });
}

function getReferenceDetail(api, prefetches, referenceIdentity, campaignId) {
    const path = referenceDetailPath(referenceIdentity, campaignId);
    return consumePrefetch(prefetches, path)
        ?? requestReferenceDetail(api, path);
}

function prefetchReferenceDetail(api, prefetches, referenceIdentity, campaignId) {
    const path = referenceDetailPath(referenceIdentity, campaignId);
    return createPrefetch(
        prefetches,
        path,
        () => requestReferenceDetail(api, path));
}

function referenceDetailPath(referenceIdentity, campaignId) {
    return campaignId
        ? `/api/campaigns/${encodeURIComponent(campaignId)}/wiki/references/${encodeURIComponent(referenceIdentity)}`
        : `/api/wiki/references/${encodeURIComponent(referenceIdentity)}`;
}

function requestReferenceDetail(api, path) {
    return api.backend(path).then(registerClassFamilyAdvancementMetadata);
}

function createPrefetch(cache, key, factory) {
    const existing = getLivePrefetch(cache, key);
    if (existing) return existing;

    const entry = {
        expiresAt: Date.now() + REFERENCE_PREFETCH_TTL_MS,
        promise: null
    };
    entry.promise = Promise.resolve()
        .then(factory)
        .catch(error => {
            if (cache.get(key) === entry) cache.delete(key);
            throw error;
        });
    cache.set(key, entry);
    return entry.promise;
}

function consumePrefetch(cache, key) {
    const promise = getLivePrefetch(cache, key);
    if (!promise) return null;
    cache.delete(key);
    return promise;
}

function getLivePrefetch(cache, key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }
    return entry.promise;
}

function projectReferenceCatalog(catalog) {
    const rules = (catalog.references ?? catalog.rules ?? []).map(reference => {
        const browse = reference.browseVariation ?? reference.effectiveVariation ?? {};
        return {
            ...reference,
            conceptKey: reference.referenceIdentity,
            ruleConceptId: reference.ruleConceptId ?? null,
            entityType: reference.effectiveCategory ?? reference.entityType,
            editionKey: browse.editionKey ?? reference.editionKey ?? reference.effectiveEditionKey ?? "",
            editionDisplayName: browse.editionDisplayName ?? reference.editionDisplayName ?? reference.effectiveEditionDisplayName ?? "",
            sourceCode: browse.sourceCode ?? reference.sourceCode ?? reference.effectiveVariation?.sourceCode ?? "",
            packageKey: browse.packageKey ?? reference.packageKey ?? reference.effectiveVariation?.packageKey ?? "",
            packageDisplayName: browse.packageDisplayName ?? reference.packageDisplayName ?? reference.effectiveVariation?.packageDisplayName ?? ""
        };
    });
    return {
        ...catalog,
        rules,
        references: rules,
        entityTypeFacets: (catalog.entityTypeFacets ?? []).map(facet => ({
            entityType: facet.value,
            count: facet.count
        })),
        sourceFacets: (catalog.sourceFacets ?? []).map(facet => ({
            sourceCode: facet.value,
            count: facet.count
        })),
        // The Phase 2 shell historically used a truthy revision number as a proxy for
        // "a browseable catalog exists." The Wiki catalog exists independently of a
        // published Rules Layer revision, so use an internal presentation sentinel.
        revisionNumber: catalog.revisionNumber ?? REFERENCE_CATALOG_SENTINEL,
        wikiReferencePublicationRevision: catalog.revisionNumber ?? null
    };
}

function projectFacetOptions(facets = []) {
    return facets.map(facet => ({
        value: facet.value,
        displayName: facet.displayName || facet.value,
        count: facet.count
    }));
}

function projectEffectiveReference(detail) {
    const reference = detail.reference;
    const effective = reference.effectiveVariation;
    return {
        ...reference,
        ruleConceptId: reference.ruleConceptId ?? null,
        conceptKey: reference.conceptKey ?? reference.referenceIdentity,
        entityType: reference.effectiveCategory,
        displayName: reference.displayName,
        sourceEntityId: effective.sourceEntityId,
        sourceEntityRevisionId: effective.sourceEntityRevisionId,
        sourceRevisionNumber: effective.sourceRevisionNumber,
        sourceEntityName: effective.name,
        sourceCode: effective.sourceCode,
        packageKey: effective.packageKey,
        packageDisplayName: effective.packageDisplayName,
        editionKey: effective.editionKey,
        editionDisplayName: effective.editionDisplayName,
        workKey: effective.publicationKey,
        workDisplayName: effective.publicationDisplayName,
        document: detail.effectiveDocument,
        wikiReferenceDetail: detail
    };
}

function projectReferenceVersions(detail) {
    const reference = detail.reference;
    return {
        ruleConceptId: reference.ruleConceptId ?? null,
        conceptKey: reference.conceptKey ?? reference.referenceIdentity,
        entityType: reference.effectiveCategory,
        displayName: reference.displayName,
        versions: (detail.variations ?? []).map(variation => ({
            ...variation,
            sourceEntityName: variation.name,
            gameEdition: variation.editionDisplayName,
            formatKey: variation.category,
            releaseKind: null,
            importedAt: null,
            equivalentRepresentationCount: 1
        }))
    };
}

export function referenceCategoryMode(search = window.location.search) {
    const requested = new URLSearchParams(search).get("category");
    return requested === "effective" ? "effective" : "any";
}

export function referenceFacetFilters(search = window.location.search) {
    const parameters = new URLSearchParams(search);
    return {
        package: (parameters.get("f.package") ?? "").trim(),
        edition: (parameters.get("f.edition") ?? "").trim()
    };
}

export function isReferenceCatalogSentinel(value) {
    return value === REFERENCE_CATALOG_SENTINEL;
}
