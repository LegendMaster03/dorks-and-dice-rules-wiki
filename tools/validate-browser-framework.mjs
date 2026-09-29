import {
    getBrowserFilterDefinitions,
    getEntityBrowserConfig,
    getEntityBrowserConfigForRoute
} from "../src/RulesWiki.Web/wwwroot/rules-browser-config.js";
import {
    activeBrowserFilterSummaries,
    browserFilterOptions,
    browserFilterValues,
    clearBrowserFilters,
    filterRulesForBrowser,
    loadCompleteBrowserDataset,
    normalizeBrowserFieldFilters,
    removeBrowserFilter,
    resolveBrowserFilterApplication
} from "../src/RulesWiki.Web/wwwroot/rules-browser-filters.js";
import {
    browserHref,
    parseBrowserViewState
} from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

const monster = getEntityBrowserConfig("monster");
assert(monster.routeFamily === "monsters", "Monster route family should be configuration-driven.");
assert(monster.sortFields.includes("cr"), "Monster CR should be a configured sort field.");
assert(monster.filters.some(value => value.key === "size"), "Monster size filter should be configured.");
assert(monster.renderer === "monster", "Monster renderer should be configured.");
assert(Array.isArray(monster.relationships), "Relationship hints should be exposed by configuration.");

const classConfig = getEntityBrowserConfig("class");
assert(classConfig.workspace === "class-family", "Class family should advertise its future specialized workspace key.");
assert(getEntityBrowserConfigForRoute("classes")?.entityType === "class", "Route lookup should resolve class config.");

const unknown = getEntityBrowserConfig("thirdPartyMystery");
assert(unknown.entityType === "thirdPartyMystery", "Unknown entity families should preserve identity.");
assert(unknown.renderer === "generic", "Unknown entity families should retain generic renderer fallback.");
assert(unknown.columns.some(value => value.key === "entityType"), "Unknown families should retain generic columns.");

const filterDefinitions = getBrowserFilterDefinitions("monster");
assert(filterDefinitions.some(value => value.key === "sourceCode" && value.mode === "server"), "Source filtering must remain server-backed.");
assert(filterDefinitions.some(value => value.key === "package" && value.mode === "client-complete"), "Package filtering should use complete accessible catalog records until Rules Core exposes a server contract.");
const editionDefinition = filterDefinitions.find(value => value.key === "edition");
assert(editionDefinition?.mode === "client-complete", "Edition filtering should be bounded to complete client datasets.");
assert(editionDefinition?.value?.property === "editionDisplayName", "Edition filtering must consume catalog edition metadata directly.");
assert(editionDefinition?.value?.property !== "formatKey", "Rules Wiki must not reinterpret representation format as edition identity.");

const rules = [
    {
        conceptKey: "monster.wolf",
        displayName: "Wolf",
        editionDisplayName: "5e",
        formatKey: "5etools-json",
        packageDisplayName: "SRD 5.1",
        browserFields: [
            { key: "type", value: "Beast" },
            { key: "size", value: "Medium" },
            { key: "cr", value: "1/4" }
        ],
        relationships: []
    },
    {
        conceptKey: "monster.owlbear",
        displayName: "Owlbear",
        editionDisplayName: "5.5e",
        formatKey: "5etools-json",
        packageDisplayName: "SRD 5.2",
        browserFields: [
            { key: "type", value: "Monstrosity" },
            { key: "size", value: "Large" },
            { key: "cr", value: "3" }
        ],
        relationships: []
    },
    {
        conceptKey: "monster.unknown-edition",
        displayName: "Unknown Edition Creature",
        editionDisplayName: "",
        formatKey: "5etools-json",
        packageDisplayName: "Custom Package",
        browserFields: [
            { key: "type", value: "Beast" },
            { key: "size", value: "Small" },
            { key: "cr", value: "1" }
        ],
        relationships: []
    }
];

const filtered = filterRulesForBrowser(rules, "monster", {
    package: "SRD 5.2",
    edition: "5.5e",
    size: "Large"
});
assert(filtered.length === 1 && filtered[0].conceptKey === "monster.owlbear", "Configured shared and family filters should compose on complete browser records.");

const sizeDefinition = filterDefinitions.find(value => value.key === "size");
assert(browserFilterOptions(rules, sizeDefinition).join(",") === "Large,Medium,Small", "Filter options should be deterministic.");
const editionOptions = browserFilterOptions(rules, editionDefinition);
assert(editionOptions.includes("5e") && editionOptions.includes("5.5e"), "Edition options should use supplied catalog edition labels.");
assert(!editionOptions.includes("5etools-json"), "Representation formats must never become edition filter values.");
assert(browserFilterValues(rules[2], editionDefinition).length === 0, "Missing authoritative edition metadata should remain safely absent.");

const normalizedUnknown = normalizeBrowserFieldFilters("thirdPartyMystery", {
    size: "Large",
    package: "Third Party",
    edition: "5e"
});
assert(!("size" in normalizedUnknown), "Unknown families should not acquire unrelated specialized filters.");
assert(normalizedUnknown.package === "Third Party", "Shared package filter should remain available to unknown families.");
assert(normalizedUnknown.edition === "5e", "Shared edition filter should remain available to unknown families.");

const routeState = parseBrowserViewState(
    "?q=dragon&sort=cr&dir=desc&source=PHB&overrides=1&f.package=SRD%205.2&f.edition=5.5e&f.size=Large&f.untrusted=bad",
    "monster");
assert(routeState.query === "dragon", "Search state should parse.");
assert(routeState.sourceCode === "PHB", "Source state should parse.");
assert(routeState.overridesOnly, "Campaign override route state should parse.");
assert(routeState.fieldFilters.package === "SRD 5.2", "Shared package filter state should parse.");
assert(routeState.fieldFilters.edition === "5.5e", "Edition filter state should parse.");
assert(routeState.fieldFilters.size === "Large", "Configured family filter state should parse.");
assert(!("untrusted" in routeState.fieldFilters), "Unknown filter route parameters should be discarded.");

const restoredSummaries = activeBrowserFilterSummaries("monster", routeState);
assert(restoredSummaries.some(value => value.key === "sourceCode" && value.label === "Source" && value.value === "PHB"), "Restored source filters should be visible in the active-filter summary.");
assert(restoredSummaries.some(value => value.key === "overridesOnly" && value.label === "Campaign state" && value.value === "Overrides only"), "Restored campaign override state should be visible in the active-filter summary.");
assert(restoredSummaries.some(value => value.key === "package" && value.label === "Package" && value.value === "SRD 5.2"), "Restored package filters should be visible in the active-filter summary.");
assert(restoredSummaries.some(value => value.key === "edition" && value.label === "Edition" && value.value === "5.5e"), "Restored edition filters should be visible in the active-filter summary.");
assert(restoredSummaries.some(value => value.key === "size" && value.label === "Size" && value.value === "Large"), "Restored family filters should be visible in the active-filter summary.");

const removedSize = removeBrowserFilter("monster", routeState, "size");
assert(!("size" in removedSize.fieldFilters), "Individual filter removal should remove only the requested family filter.");
assert(removedSize.fieldFilters.edition === "5.5e", "Individual filter removal should preserve other active filters.");
assert(removedSize.sourceCode === "PHB" && removedSize.overridesOnly, "Individual filter removal should preserve server-backed filters.");

const cleared = clearBrowserFilters("monster");
assert(cleared.sourceCode === "" && !cleared.overridesOnly && Object.keys(cleared.fieldFilters).length === 0, "Clear-all should remove every non-search browser filter.");

globalThis.window = {
    location: {
        search: "?q=dragon&source=PHB&overrides=1&f.package=SRD%205.2&f.edition=5.5e&f.size=Large"
    }
};
const routedApp = {
    hostContext: { toolBasePath: "/tools/rules-wiki" },
    browserScope: "campaign:campaign-1",
    browserSort: { key: "cr", direction: "desc" },
    browserFilters: {
        entityType: "monster",
        query: "dragon",
        sourceCode: removedSize.sourceCode,
        overridesOnly: removedSize.overridesOnly,
        fieldFilters: removedSize.fieldFilters
    }
};
const removedHref = browserHref(routedApp, "/monsters", routedApp.browserScope);
assert(!removedHref.includes("f.size="), "Removing one summarized filter should remove it from route state.");
assert(removedHref.includes("f.edition=5.5e") && removedHref.includes("f.package=SRD+5.2"), "Removing one summarized filter should preserve other route filters.");
routedApp.browserFilters = {
    ...routedApp.browserFilters,
    sourceCode: cleared.sourceCode,
    overridesOnly: cleared.overridesOnly,
    fieldFilters: cleared.fieldFilters
};
const clearedHref = browserHref(routedApp, "/monsters", routedApp.browserScope);
assert(!clearedHref.includes("source=") && !clearedHref.includes("overrides=1") && !clearedHref.includes("f."), "Clear-all should update route state consistently.");

const pending = resolveBrowserFilterApplication(
    rules.slice(0, 2),
    "monster",
    { edition: "5.5e", size: "Large" },
    false);
assert(pending.state === "pending", "Client-complete filters should remain pending until the authoritative result set is complete.");
assert(pending.rules.length === 0, "A partial dataset must not be displayed as satisfying active client-complete filters.");
const applied = resolveBrowserFilterApplication(
    rules,
    "monster",
    { edition: "5.5e", size: "Large" },
    true);
assert(applied.state === "applied", "Client-complete filters should apply after the complete result set is available.");
assert(applied.rules.length === 1 && applied.rules[0].conceptKey === "monster.owlbear", "Completed client filtering should return only matching records.");
const unfilteredPartial = resolveBrowserFilterApplication(rules.slice(0, 2), "monster", {}, false);
assert(unfilteredPartial.state === "inactive" && unfilteredPartial.rules.length === 2, "Incremental browsing without client filters should continue to display loaded records.");

let stagedLength = 2;
let stagedHasMore = true;
let stagedError = null;
let stagedAttempt = 0;
const failedCompletion = await loadCompleteBrowserDataset({
    hasMore: () => stagedHasMore,
    getLength: () => stagedLength,
    getError: () => stagedError,
    loadMore: async () => {
        stagedAttempt += 1;
        if (stagedAttempt === 1) {
            stagedLength += 2;
            return;
        }
        if (stagedAttempt === 2) {
            stagedLength += 2;
            return;
        }
        stagedError = "later page failed";
    }
});
assert(!failedCompletion.complete && failedCompletion.error === "later page failed", "A later page failure must leave complete-catalog loading explicitly incomplete.");
assert(stagedLength === 6 && stagedHasMore, "Earlier successful pages must not cause a later failure to be treated as complete.");
const failedApplication = resolveBrowserFilterApplication(
    rules.slice(0, 2),
    "monster",
    { edition: "5.5e" },
    failedCompletion.complete);
assert(failedApplication.state === "pending" && failedApplication.rules.length === 0, "Rows must remain hidden when a later load-all page fails under an active client filter.");

stagedError = null;
const retriedCompletion = await loadCompleteBrowserDataset({
    hasMore: () => stagedHasMore,
    getLength: () => stagedLength,
    getError: () => stagedError,
    loadMore: async () => {
        stagedLength += 2;
        stagedHasMore = false;
    }
});
assert(retriedCompletion.complete && retriedCompletion.error === null, "Retry should report completion once the remaining authoritative page loads.");
assert(stagedLength === 8 && !stagedHasMore, "Retry should preserve prior progress and finish the complete dataset.");

console.log("Browser framework validation passed.");
