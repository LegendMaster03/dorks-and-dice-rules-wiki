const REFERENCE_CATALOG_SENTINEL = "reference-catalog";

export function installWikiReferenceApi(api) {
    api.getGlobalRulesCatalog = filters => getCatalog(api, null, filters);
    api.getCampaignRulesCatalog = (campaignId, filters) => getCatalog(api, campaignId, filters);

    api.getWikiReferenceDetail = (referenceIdentity, campaignId = null) =>
        api.backend(campaignId
            ? `/api/campaigns/${encodeURIComponent(campaignId)}/wiki/references/${encodeURIComponent(referenceIdentity)}`
            : `/api/wiki/references/${encodeURIComponent(referenceIdentity)}`);

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

function getCatalog(api, campaignId, filters = {}) {
    const parameters = new URLSearchParams();
    const routedFacets = referenceFacetFilters();
    if (filters.entityType) parameters.set("entityType", filters.entityType);
    if (filters.query) parameters.set("q", filters.query);
    if (filters.sourceCode) parameters.set("source", filters.sourceCode);
    if (filters.packageKey ?? routedFacets.package) parameters.set("package", filters.packageKey ?? routedFacets.package);
    if (filters.edition ?? routedFacets.edition) parameters.set("edition", filters.edition ?? routedFacets.edition);
    if (campaignId && filters.overridesOnly) parameters.set("overridesOnly", "true");
    parameters.set("categoryMode", referenceCategoryMode());
    parameters.set("limit", String(filters.limit ?? 200));
    parameters.set("offset", String(Math.max(0, filters.offset ?? 0)));

    const path = campaignId
        ? `/api/campaigns/${encodeURIComponent(campaignId)}/wiki/references`
        : "/api/wiki/references";
    return api.backend(`${path}?${parameters.toString()}`).then(catalog =>
        projectReferenceCatalog(catalog, routedFacets));
}

function projectReferenceCatalog(catalog, routedFacets = {}) {
    const rules = (catalog.references ?? catalog.rules ?? []).map(reference => ({
        ...reference,
        conceptKey: reference.referenceIdentity,
        ruleConceptId: reference.ruleConceptId ?? reference.referenceIdentity,
        entityType: reference.effectiveCategory ?? reference.entityType,
        editionKey: reference.effectiveEditionKey ?? reference.editionKey ?? "",
        editionDisplayName: routedFacets.edition
            || reference.effectiveEditionDisplayName
            || reference.editionDisplayName
            || "",
        sourceCode: reference.sourceCode ?? reference.effectiveVariation?.sourceCode ?? "",
        packageKey: reference.packageKey ?? reference.effectiveVariation?.packageKey ?? "",
        packageDisplayName: routedFacets.package
            || reference.packageDisplayName
            || reference.effectiveVariation?.packageDisplayName
            || ""
    }));
    return {
        ...catalog,
        rules,
        references: rules,
        // The Phase 2 shell historically used a truthy revision number as a proxy for
        // "a browseable catalog exists." The Wiki catalog exists independently of a
        // published Rules Layer revision, so use an internal presentation sentinel.
        revisionNumber: catalog.revisionNumber ?? REFERENCE_CATALOG_SENTINEL,
        wikiReferencePublicationRevision: catalog.revisionNumber ?? null
    };
}

function projectEffectiveReference(detail) {
    const reference = detail.reference;
    const effective = reference.effectiveVariation;
    return {
        ...reference,
        ruleConceptId: reference.referenceIdentity,
        conceptKey: reference.referenceIdentity,
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
        ruleConceptId: reference.referenceIdentity,
        conceptKey: reference.referenceIdentity,
        entityType: reference.effectiveCategory,
        displayName: reference.displayName,
        versions: (detail.variations ?? []).map(variation => ({
            ...variation,
            sourceEntityName: variation.name,
            gameEdition: variation.editionDisplayName,
            formatKey: variation.nativeEntityType,
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
