import {
    getBrowserFilterDefinitions,
    getEntityBrowserConfig,
    getEntityBrowserConfigForRoute
} from "../src/RulesWiki.Web/wwwroot/rules-browser-config.js";
import {
    browserFilterOptions,
    filterRulesForBrowser,
    normalizeBrowserFieldFilters
} from "../src/RulesWiki.Web/wwwroot/rules-browser-filters.js";
import { parseBrowserViewState } from "../src/RulesWiki.Web/wwwroot/rules-browser-routing.js";

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
assert(filterDefinitions.some(value => value.key === "edition" && value.mode === "client-complete"), "Edition filtering should be bounded to complete client datasets until Rules Core exposes a server contract.");

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
    }
];

const filtered = filterRulesForBrowser(rules, "monster", {
    package: "SRD 5.2",
    edition: "5.5e",
    size: "Large"
});
assert(filtered.length === 1 && filtered[0].conceptKey === "monster.owlbear", "Configured shared and family filters should compose on complete browser records.");

const sizeDefinition = filterDefinitions.find(value => value.key === "size");
assert(browserFilterOptions(rules, sizeDefinition).join(",") === "Large,Medium", "Filter options should be deterministic.");

const normalizedUnknown = normalizeBrowserFieldFilters("thirdPartyMystery", {
    size: "Large",
    package: "Third Party",
    edition: "5e"
});
assert(!("size" in normalizedUnknown), "Unknown families should not acquire unrelated specialized filters.");
assert(normalizedUnknown.package === "Third Party", "Shared package filter should remain available to unknown families.");
assert(normalizedUnknown.edition === "5e", "Shared edition filter should remain available to unknown families.");

const routeState = parseBrowserViewState(
    "?q=dragon&sort=cr&dir=desc&source=MM&overrides=1&f.package=SRD%205.2&f.size=Large&f.untrusted=bad",
    "monster");
assert(routeState.query === "dragon", "Search state should parse.");
assert(routeState.sourceCode === "MM", "Source state should parse.");
assert(routeState.overridesOnly, "Campaign override route state should parse.");
assert(routeState.fieldFilters.package === "SRD 5.2", "Shared package filter state should parse.");
assert(routeState.fieldFilters.size === "Large", "Configured family filter state should parse.");
assert(!("untrusted" in routeState.fieldFilters), "Unknown filter route parameters should be discarded.");

console.log("Browser framework validation passed.");
