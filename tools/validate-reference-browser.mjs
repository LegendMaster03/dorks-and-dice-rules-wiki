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
import {
    openReferenceAdjudication,
    referenceAdjudicationTarget
} from "../src/RulesWiki.Web/wwwroot/rules-browser-detail.js";

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
        category: "subclass",
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
assert(globalCatalog.rules[0].ruleConceptId === null, "Source-only references must not fabricate a RuleConcept ID.");
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
assert(detail.variations.length === 1 && detail.variations[0].category === "subclass", "Detail should expose one canonical mechanical category per variation.");
assert(!("nativeEntityType" in detail.variations[0]), "Detail must not expose a redundant source-native category field.");
assert(detail.reference.resolutionState === "unresolved-fallback", "Unresolved fallback state must remain distinct from a ruling.");

const projectedVersions = await fakeApi.getRuleVersions("canonical:0123");
assert(projectedVersions.ruleConceptId === null, "Source-only version history must not fabricate an adjudication target.");
assert(projectedVersions.versions.length === 1, "Normal readers should obtain accessible reference history through the Wiki detail API.");
assert(projectedVersions.versions[0].gameEdition === "5e", "Version projection should use authoritative edition metadata.");
assert(projectedVersions.versions[0].formatKey === "subclass", "Version compatibility projection should use the canonical category.");

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

const globalLawyerTarget = referenceAdjudicationTarget(
    { canEditGlobal: true, dmCampaigns: [] },
    "concept-1",
    null);
assert(globalLawyerTarget?.scope === "global", "Rules Lawyer should receive a global adjudication target.");
assert(globalLawyerTarget?.label === "Edit Dorks & Dice rule", "Global adjudication target should use the existing Rules Lawyer action.");
assert(referenceAdjudicationTarget(
    { canEditGlobal: false, dmCampaigns: [] },
    "concept-1",
    null) === null, "Ordinary global readers must not receive mutation controls.");

const campaignDmTarget = referenceAdjudicationTarget(
    { canEditGlobal: false, dmCampaigns: [{ id: "campaign-1" }] },
    "concept-1",
    "campaign-1");
assert(campaignDmTarget?.scope === "campaign", "Campaign DM should receive a campaign adjudication target.");
assert(campaignDmTarget?.label === "Edit campaign rule", "Campaign adjudication target should use the existing DM action.");
assert(referenceAdjudicationTarget(
    { canEditGlobal: false, dmCampaigns: [] },
    "concept-1",
    "campaign-1") === null, "Campaign Player must not receive mutation controls.");
assert(referenceAdjudicationTarget(
    { canEditGlobal: true, dmCampaigns: [{ id: "campaign-1" }] },
    null,
    null) === null, "Source-only references must remain read-only even for a Rules Lawyer.");
assert(referenceAdjudicationTarget(
    { canEditGlobal: true, dmCampaigns: [{ id: "campaign-1" }] },
    null,
    "campaign-1") === null, "Source-only references must remain read-only even for a campaign DM.");

const globalTransitions = [];
const globalBody = { id: "global-body" };
const globalApp = {
    activeView: "reference",
    activeCampaignId: "old-campaign",
    root: { querySelector: selector => selector === ".rules-core-main" ? globalBody : null },
    async render() { globalTransitions.push(["render", this.activeView, this.activeCampaignId]); },
    async renderGlobalConcept(body, conceptId) { globalTransitions.push(["global", body, conceptId]); },
    async renderCampaignConcept() { throw new Error("Global transition must not open campaign editor."); }
};
await openReferenceAdjudication(globalApp, "concept-1", null);
assert(globalApp.activeView === "global", "Global adjudication transition should restore the global authoring view.");
assert(globalTransitions.some(value => value[0] === "global" && value[1] === globalBody && value[2] === "concept-1"),
    "Global adjudication transition should open the existing editor for the same RuleConcept.");

const campaignTransitions = [];
const campaignBody = { id: "campaign-body" };
const campaignApp = {
    activeView: "reference",
    activeCampaignId: null,
    root: { querySelector: selector => selector === ".rules-core-main" ? campaignBody : null },
    async render() { campaignTransitions.push(["render", this.activeView, this.activeCampaignId]); },
    async renderGlobalConcept() { throw new Error("Campaign transition must not open global editor."); },
    async renderCampaignConcept(body, conceptId) { campaignTransitions.push(["campaign", body, conceptId, this.activeCampaignId]); }
};
await openReferenceAdjudication(campaignApp, "concept-1", "campaign-1");
assert(campaignApp.activeView === "campaign", "Campaign adjudication transition should restore campaign authoring view.");
assert(campaignApp.activeCampaignId === "campaign-1", "Campaign adjudication transition must preserve the selected campaign scope.");
assert(campaignTransitions.some(value => value[0] === "campaign"
    && value[1] === campaignBody
    && value[2] === "concept-1"
    && value[3] === "campaign-1"),
    "Campaign adjudication transition should open the existing editor for the same concept and selected campaign.");

const unknown = getEntityBrowserConfig("importedMysteryFamily");
assert(unknown.renderer === "generic", "Imported/unknown families must retain generic fallback rendering.");
assert(unknown.columns.some(value => value.key === "entityType"), "Generic fallback should retain an entity-type column.");

console.log("Rules Wiki Phase 2.5 reference-browser validation passed.");
