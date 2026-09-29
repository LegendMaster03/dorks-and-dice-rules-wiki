import {
    getBrowserFilterDefinitions,
    getEntityBrowserConfig,
    getEntityBrowserConfigForRoute
} from "../src/RulesWiki.Web/wwwroot/rules-browser-config.js";
import {
    activeBrowserFilterSummaries,
    browserFilterOptions,
    clearBrowserFilters,
    filterRulesForBrowser,
    hasClientBrowserFilters,
    loadCompleteBrowserDataset,
    normalizeBrowserFieldFilters,
    normalizeBrowserFieldFiltersForEntityTransition,
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
assert(classConfig.workspace === "class-family", "Class family should retain its specialized workspace key.");
assert(getEntityBrowserConfigForRoute("classes")?.entityType === "class", "Class route lookup should remain configuration-driven.");
assert(getEntityBrowserConfigForRoute("races")?.entityType === "species", "Legacy race routes should resolve to Species.");
assert(getEntityBrowserConfigForRoute("subraces")?.entityType === "subspecies", "Legacy subrace routes should resolve to Subspecies.");
assert(getEntityBrowserConfig("race").entityType === "species", "Race content should normalize to Species.");
assert(getEntityBrowserConfig("subrace").entityType === "subspecies", "Subrace content should normalize to Subspecies.");

const unknown = getEntityBrowserConfig("thirdPartyMystery");
assert(unknown.entityType === "thirdPartyMystery", "Unknown entity families should preserve identity.");
assert(unknown.renderer === "generic", "Unknown entity families should retain generic renderer fallback.");
assert(unknown.columns.some(value => value.key === "entityType"), "Unknown families should retain generic columns.");

const filterDefinitions = getBrowserFilterDefinitions("monster");
const packageDefinition = filterDefinitions.find(value => value.key === "package");
const editionDefinition = filterDefinitions.find(value => value.key === "edition");
const sizeDefinition = filterDefinitions.find(value => value.key === "size");
assert(filterDefinitions.some(value => value.key === "sourceCode" && value.mode === "server"), "Source filtering must remain server-backed.");
assert(packageDefinition?.mode === "server-reference", "Package filtering should use the Rules Core reference contract.");
assert(packageDefinition?.value?.facet === "package", "Package filtering should consume the authoritative package facet.");
assert(editionDefinition?.mode === "server-reference", "Edition filtering should use the Rules Core reference contract.");
assert(editionDefinition?.value?.facet === "edition", "Edition filtering should consume the authoritative edition facet.");
assert(sizeDefinition?.mode === "client-complete", "Type-specific filters should remain client-complete until they gain a server contract.");

const rules = [
    {
        conceptKey: "monster.wolf",
        displayName: "Wolf",
        editionDisplayName: "5e",
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
        packageDisplayName: "Custom Package",
        browserFields: [
            { key: "type", value: "Beast" },
            { key: "size", value: "Small" },
            { key: "cr", value: "1" }
        ],
        relationships: []
    }
];

assert(browserFilterOptions(rules, sizeDefinition).join(",") === "Large,Medium,Small", "Type-specific filter options should remain deterministic.");
const filtered = filterRulesForBrowser(rules, "monster", {
    package: "historical-package-key",
    edition: "3.5e",
    size: "Large"
});
assert(filtered.length === 1 && filtered[0].conceptKey === "monster.owlbear", "Server reference filters must not be re-applied against effective-row values; client filters should still apply.");
assert(!hasClientBrowserFilters("monster", { package: "pkg", edition: "3.5e" }), "Package and Edition alone must not force complete client loading.");
assert(hasClientBrowserFilters("monster", { package: "pkg", size: "Large" }), "A type-specific filter must still require the complete client result set.");

const normalizedUnknown = normalizeBrowserFieldFilters("thirdPartyMystery", {
    size: "Large",
    package: "Third Party",
    edition: "5e"
});
assert(!("size" in normalizedUnknown), "Unknown families should not acquire unrelated specialized filters.");
assert(normalizedUnknown.package === "Third Party", "Shared package filter should remain available to unknown families.");
assert(normalizedUnknown.edition === "5e", "Shared edition filter should remain available to unknown families.");

const monsterToSpell = normalizeBrowserFieldFiltersForEntityTransition(
    "monster",
    "spell",
    {
        package: "SRD 5.2",
        edition: "5.5e",
        size: "Large",
        cr: "3"
    });
assert(monsterToSpell.package === "SRD 5.2", "Monster to Spell should preserve Package.");
assert(monsterToSpell.edition === "5.5e", "Monster to Spell should preserve Edition.");
assert(!("size" in monsterToSpell), "Monster to Spell should discard monster-only Size.");
assert(!("cr" in monsterToSpell), "Monster to Spell should discard monster-only CR.");

const spellToItem = normalizeBrowserFieldFiltersForEntityTransition(
    "spell",
    "item",
    {
        package: "SRD 5.2",
        edition: "5.5e",
        level: "3",
        school: "Evocation"
    });
assert(spellToItem.package === "SRD 5.2" && spellToItem.edition === "5.5e", "Spell to Item should retain shared server reference filters.");
assert(!("level" in spellToItem) && !("school" in spellToItem), "Spell to Item should discard spell-only filters.");

const knownToUnknown = normalizeBrowserFieldFiltersForEntityTransition(
    "monster",
    "thirdPartyMystery",
    {
        package: "SRD 5.2",
        edition: "5.5e",
        size: "Large",
        cr: "3"
    });
assert(knownToUnknown.package === "SRD 5.2" && knownToUnknown.edition === "5.5e", "Known to generic should preserve shared server reference filters.");
assert(!("size" in knownToUnknown) && !("cr" in knownToUnknown), "Known to generic should discard specialized filters.");

const raceToSpecies = normalizeBrowserFieldFiltersForEntityTransition(
    "race",
    "species",
    {
        package: "SRD 5.2",
        edition: "5.5e",
        size: "Medium",
        ability: "Dexterity"
    });
assert(raceToSpecies.size === "Medium" && raceToSpecies.ability === "Dexterity", "Equivalent Species family filters should survive legacy route transitions.");

const routeState = parseBrowserViewState(
    "?q=dragon&sort=cr&dir=desc&source=PHB&overrides=1&f.package=SRD%205.2&f.edition=5.5e&f.size=Large&f.untrusted=bad",
    "monster");
assert(routeState.query === "dragon", "Search state should parse.");
assert(routeState.sourceCode === "PHB", "Source state should parse.");
assert(routeState.overridesOnly, "Campaign override route state should parse.");
assert(routeState.fieldFilters.package === "SRD 5.2", "Package route state should parse.");
assert(routeState.fieldFilters.edition === "5.5e", "Edition route state should parse.");
assert(routeState.fieldFilters.size === "Large", "Configured family filter state should parse.");
assert(!("untrusted" in routeState.fieldFilters), "Unknown route filter parameters should be discarded.");

const restoredSummaries = activeBrowserFilterSummaries("monster", routeState);
assert(restoredSummaries.some(value => value.key === "sourceCode" && value.value === "PHB"), "Source should be visible in active-filter summaries.");
assert(restoredSummaries.some(value => value.key === "overridesOnly"), "Campaign override state should be visible in active-filter summaries.");
assert(restoredSummaries.some(value => value.key === "package" && value.value === "SRD 5.2"), "Server-backed Package should be visible in active-filter summaries.");
assert(restoredSummaries.some(value => value.key === "edition" && value.value === "5.5e"), "Server-backed Edition should be visible in active-filter summaries.");
assert(restoredSummaries.some(value => value.key === "size" && value.value === "Large"), "Type-specific filters should be visible in active-filter summaries.");

const removedSize = removeBrowserFilter("monster", routeState, "size");
assert(!("size" in removedSize.fieldFilters), "Individual removal should remove only the requested type-specific filter.");
assert(removedSize.fieldFilters.package === "SRD 5.2" && removedSize.fieldFilters.edition === "5.5e", "Individual removal should preserve server reference filters.");
const removedPackage = removeBrowserFilter("monster", routeState, "package");
assert(!("package" in removedPackage.fieldFilters) && removedPackage.fieldFilters.edition === "5.5e", "Package removal should preserve Edition.");

const cleared = clearBrowserFilters("monster");
assert(cleared.sourceCode === "" && !cleared.overridesOnly && Object.keys(cleared.fieldFilters).length === 0, "Clear-all should remove every non-search browser filter.");

globalThis.window = {
    location: {
        search: "?q=dragon&source=PHB&overrides=1&f.package=SRD%205.2&f.edition=5.5e&f.size=Large&f.cr=3"
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
assert(!removedHref.includes("f.size="), "Removed filters should leave route state.");
assert(removedHref.includes("f.edition=5.5e") && removedHref.includes("f.package=SRD+5.2"), "Server reference filters should remain in route state.");
routedApp.browserFilters = {
    ...routedApp.browserFilters,
    sourceCode: cleared.sourceCode,
    overridesOnly: cleared.overridesOnly,
    fieldFilters: cleared.fieldFilters
};
const clearedHref = browserHref(routedApp, "/monsters", routedApp.browserScope);
assert(!clearedHref.includes("source=") && !clearedHref.includes("overrides=1") && !clearedHref.includes("f."), "Clear-all should update route state consistently.");

const spellTransitionApp = {
    hostContext: { toolBasePath: "/tools/rules-wiki" },
    browserScope: "campaign:campaign-1",
    browserSort: { key: null, direction: "asc" },
    browserFilters: {
        entityType: "spell",
        query: "dragon",
        sourceCode: "PHB",
        overridesOnly: true,
        fieldFilters: monsterToSpell
    }
};
const spellHref = browserHref(spellTransitionApp, "/spells", spellTransitionApp.browserScope);
assert(spellHref.includes("f.package=SRD+5.2") && spellHref.includes("f.edition=5.5e"), "Family switching should retain server reference filters.");
assert(!spellHref.includes("f.size=") && !spellHref.includes("f.cr="), "Family switching must omit invalid specialized filters.");
assert(spellHref.includes("q=dragon") && spellHref.includes("source=PHB") && spellHref.includes("overrides=1"), "Family switching should preserve search and server-backed state.");
const spellRestored = parseBrowserViewState(new URL(spellHref, "https://rules.example").search, "spell");
assert(spellRestored.fieldFilters.package === "SRD 5.2" && spellRestored.fieldFilters.edition === "5.5e", "Refresh or Back/Forward should restore server reference filters.");
assert(!("size" in spellRestored.fieldFilters) && !("cr" in spellRestored.fieldFilters), "Refresh or Back/Forward must not restore stale specialized filters.");

const serverOnlyPartial = resolveBrowserFilterApplication(
    rules.slice(0, 2),
    "monster",
    { package: "historical-package-key", edition: "3.5e" },
    false);
assert(serverOnlyPartial.state === "inactive" && serverOnlyPartial.rules.length === 2, "Server reference filters should not block incremental rendering after Core has applied them.");

const pending = resolveBrowserFilterApplication(
    rules.slice(0, 2),
    "monster",
    { edition: "3.5e", size: "Large" },
    false);
assert(pending.state === "pending", "Type-specific client filters should remain pending until the authoritative result set is complete.");
assert(pending.rules.length === 0, "A partial dataset must not be displayed as satisfying an active client-complete filter.");
const applied = resolveBrowserFilterApplication(
    rules,
    "monster",
    { edition: "3.5e", size: "Large" },
    true);
assert(applied.state === "applied", "Type-specific client filters should apply after the complete result set is available.");
assert(applied.rules.length === 1 && applied.rules[0].conceptKey === "monster.owlbear", "Client filtering should not re-apply the historical Edition criterion.");

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
        if (stagedAttempt <= 2) {
            stagedLength += 2;
            return;
        }
        stagedError = "later page failed";
    }
});
assert(!failedCompletion.complete && failedCompletion.error === "later page failed", "Complete-dataset loading should stop on a later-page error.");

stagedLength = 2;
stagedHasMore = true;
stagedError = null;
stagedAttempt = 0;
const completed = await loadCompleteBrowserDataset({
    hasMore: () => stagedHasMore,
    getLength: () => stagedLength,
    getError: () => stagedError,
    loadMore: async () => {
        stagedAttempt += 1;
        stagedLength += 2;
        if (stagedAttempt === 2) stagedHasMore = false;
    }
});
assert(completed.complete && !completed.error && stagedLength === 6, "Complete-dataset loading should finish when all pages load successfully.");

console.log("Browser framework validation passed.");
