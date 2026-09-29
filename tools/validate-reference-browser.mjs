import {
    RULE_FAMILY_TABS,
    getEntityBrowserConfig,
    getEntityBrowserConfigForRoute
} from "../src/RulesWiki.Web/wwwroot/rules-browser-config.js";
import {
    catalogRouteForEntity,
    parseToolRoute
} from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";
import {
    installWikiReferenceApi,
    referenceCategoryMode,
    referenceFacetFilters
} from "../src/RulesWiki.Web/wwwroot/rules-reference-api.js";
import {
    browserColumnValue,
    sortRulesForBrowser
} from "../src/RulesWiki.Web/wwwroot/rules-browser-index.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

globalThis.window = {
    location: {
        pathname: "/tools/rules-wiki/prestige-classes",
        search: "?category=effective"
    }
};

assert(referenceCategoryMode() === "effective", "Category mode should restore from browser history/query state.");
window.location.search = "";
assert(referenceCategoryMode() === "any", "Historical any-variation mode should be the default.");
window.location.search = "?category=effective&f.package=third-party&f.edition=5e";
assert(referenceFacetFilters().package === "third-party", "Package reference filters should restore from route state.");
assert(referenceFacetFilters().edition === "5e", "Edition reference filters should restore from route state.");

assert(!RULE_FAMILY_TABS.some(([entityType]) => entityType === "race"), "Race must not remain a standalone normal browser family.");
assert(RULE_FAMILY_TABS.some(([entityType]) => entityType === "species"), "Species must remain a normal browser family.");
assert(RULE_FAMILY_TABS.some(([entityType]) => entityType === "subspecies"), "Subspecies must be a normal browser family.");
assert(getEntityBrowserConfig("race").entityType === "species", "Race should canonicalize to Species for browsing.");
assert(getEntityBrowserConfig("subrace").entityType === "subspecies", "Subrace should canonicalize to Subspecies for browsing.");
assert(getEntityBrowserConfigForRoute("races")?.entityType === "species", "Legacy /races routes should resolve to Species.");
assert(getEntityBrowserConfigForRoute("subraces")?.entityType === "subspecies", "Legacy /subraces routes should resolve to Subspecies.");
assert(parseToolRoute("/races/elf").conceptKey === "species.elf", "Legacy race detail links should resolve to canonical Species identity.");
assert(parseToolRoute("/subraces/high-elf").conceptKey === "subspecies.high-elf", "Legacy subrace detail links should resolve to canonical Subspecies identity.");
assert(parseToolRoute("/references/canonical%3A0123").conceptKey === "canonical:0123", "Source-only reference links should round-trip stable Core-owned identity.");
assert(catalogRouteForEntity("species") === "/species", "Species should use its canonical browser route.");
assert(catalogRouteForEntity("subspecies") === "/subspecies", "Subspecies should use its canonical browser route.");

const calls = [];
const sourceOnlyReference = {
    referenceIdentity: "canonical:0123",
    ruleConceptId: null,
    conceptKey: null,
    displayName: "Source Only Fixture",
    entityType: "prestigeClass",
    effectiveCategory: "subclass",
    effectiveEditionKey: "5e",
    effectiveEditionDisplayName: "5e",
    resolutionState: "unresolved-fallback",
    hasCampaignOverride: false,
    effectiveVariation: {
        sourceEntityId: "source-entity",
        sourceEntityRevisionId: "source-revision",
        sourceRevisionNumber: 1,
        name: "Source Only Fixture",
        sourceCode: "NONSRD",
        packageKey: "third-party",
        packageDisplayName: "Third Party",
        editionKey: "5e",
        editionDisplayName: "5e",
        publicationKey: "publication",
        publicationDisplayName: "Publication"
    },
    categoryHistory: [
        { category: "prestigeClass", editions: ["3.5e"] },
        { category: "subclass", editions: ["5e"] }
    ],
    browserFields: [],
    relationships: [],
    browserLink: {
        toolSlug: "rules-wiki",
        toolRelativePath: "/references/canonical%3A0123",
        canonicalKey: "canonical:0123"
    }
};
const fakeApi = {
    async backend(path, options = undefined) {
        calls.push({ path, options });
        if (path.includes("/comparison")) return { differences: [] };
        if (path.includes("/wiki/references/") && !path.includes("?")) {
            return {
                scope: path.includes("/campaigns/") ? "campaign" : "global",
                campaignId: path.includes("/campaigns/") ? "campaign-1" : null,
                reference: sourceOnlyReference,
                variations: [
                    {
                        sourceEntityRevisionId: "source-revision",
                        sourceRevisionNumber: 1,
                        name: "Source Only Fixture",
                        nativeEntityType: "subclass",
                        category: "subclass",
                        sourceCode: "NONSRD",
                        packageKey: "third-party",
                        packageDisplayName: "Third Party",
                        publicationKey: "publication",
                        publicationDisplayName: "Publication",
                        editionKey: "5e",
                        editionDisplayName: "5e",
                        isEffective: true,
                        document: { name: "Source Only Fixture" }
                    }
                ],
                effectiveDocument: { name: "Source Only Fixture" }
            };
        }
        return {
            scope: path.includes("/campaigns/") ? "campaign" : "global",
            campaignId: path.includes("/campaigns/") ? "campaign-1" : null,
            revisionNumber: 7,
            totalCount: 1,
            categoryMode: "effective",
            entityTypeFacets: [{ value: "subclass", displayName: "subclass", count: 1 }],
            sourceFacets: [{ value: "NONSRD", displayName: "NONSRD", count: 1 }],
            packageFacets: [{ value: "third-party", displayName: "Third Party", count: 1 }],
            editionFacets: [{ value: "5e", displayName: "5e", count: 1 }],
            references: [sourceOnlyReference]
        };
    }
};
installWikiReferenceApi(fakeApi);

const globalCatalog = await fakeApi.getGlobalRulesCatalog({
    entityType: "prestigeClass",
    query: "fixture",
    sourceCode: "NONSRD",
    limit: 50,
    offset: 0
});
assert(calls[0].path.startsWith("/api/wiki/references?"), "Primary global index must use the Wiki reference API, not /api/rules.");
assert(!calls[0].path.startsWith("/api/rules"), "Primary global index must not use the resolved consumer API.");
assert(calls[0].path.includes("entityType=prestigeClass"), "Historical category should be sent to Core.");
assert(calls[0].path.includes("categoryMode=effective"), "Selected effective-category mode should be sent to Core.");
assert(calls[0].path.includes("source=NONSRD"), "Source filters should remain server-backed.");
assert(calls[0].path.includes("package=third-party"), "Package filters should be sent to the server reference API.");
assert(calls[0].path.includes("edition=5e"), "Edition filters should be sent to the server reference API.");
assert(globalCatalog.rules.length === 1, "One logical reference should project to one browser row.");
assert(globalCatalog.rules[0].conceptKey === "canonical:0123", "Source-only references should remain selectable without a RuleConcept.");
assert(globalCatalog.rules[0].sourceCode === "NONSRD", "Effective source metadata should project into the reusable Phase 2 columns.");
assert(globalCatalog.rules[0].editionDisplayName === "5e", "Effective edition metadata should remain the row value even when history filters are active.");
assert(globalCatalog.entityTypeFacets[0].entityType === "subclass", "Core entity facets should project into the reusable Type control contract.");
assert(globalCatalog.sourceFacets[0].sourceCode === "NONSRD", "Core source facets should project into the reusable Source control contract.");
assert(fakeApi.referenceFacets.package[0].value === "third-party", "Package facet values should remain Core-owned package identities.");
assert(fakeApi.referenceFacets.package[0].displayName === "Third Party", "Package facets should retain human-readable labels.");
assert(fakeApi.referenceFacets.edition[0].value === "5e", "Edition facet values should remain authoritative edition keys.");
assert(browserColumnValue(globalCatalog.rules[0], "entityType") === "Subclass", "Effective category should drive the row's current type column.");
assert(sortRulesForBrowser(globalCatalog.rules, "prestigeClass", { key: "name", direction: "asc" }).length === 1, "Source-only references should participate in reusable sorting.");

const detail = await fakeApi.getWikiReferenceDetail("canonical:0123");
assert(detail.reference.referenceIdentity === "canonical:0123", "Reference detail should preserve logical identity.");
assert(detail.variations.length === 1 && detail.variations[0].nativeEntityType === "subclass", "Detail should expose source-native variation category.");
assert(detail.reference.resolutionState === "unresolved-fallback", "Unresolved fallback state must remain distinct from a ruling.");

const projectedVersions = await fakeApi.getRuleVersions("canonical:0123");
assert(projectedVersions.versions.length === 1, "Normal readers should obtain accessible reference history through the Wiki detail API.");
assert(projectedVersions.versions[0].gameEdition === "5e", "Version projection should use authoritative edition metadata.");

await fakeApi.compareRuleVersions({
    referenceIdentity: "canonical:0123",
    leftSourceEntityRevisionId: "left",
    rightSourceEntityRevisionId: "right"
});
const comparisonCall = calls.at(-1);
assert(comparisonCall.path === "/api/wiki/references/comparison", "Read-only comparison should use the Wiki comparison endpoint.");
assert(comparisonCall.options.body.referenceIdentity === "canonical:0123", "Comparison must remain scoped to logical reference identity.");

await fakeApi.getCampaignRulesCatalog("campaign-1", {
    entityType: "subclass",
    query: "fixture",
    sourceCode: "NONSRD",
    overridesOnly: true,
    limit: 25,
    offset: 0
});
const campaignCall = calls.at(-1).path;
assert(campaignCall.startsWith("/api/campaigns/campaign-1/wiki/references?"), "Campaign browsing should use the campaign Wiki reference contract.");
assert(campaignCall.includes("overridesOnly=true"), "Campaign override filtering should remain server-backed.");

const unknown = getEntityBrowserConfig("importedMysteryFamily");
assert(unknown.renderer === "generic", "Imported/unknown families must retain generic fallback rendering.");
assert(unknown.columns.some(value => value.key === "entityType"), "Generic fallback should retain an entity-type column.");

console.log("Rules Wiki Phase 2.5 reference-browser validation passed.");
